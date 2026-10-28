-- TEND schema for Supabase. Apply in the Supabase SQL editor or with the CLI.
-- Public browser clients use only the anon/publishable key; access is enforced by RLS.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

do $$ begin
  create type public.tend_role as enum ('user', 'staff', 'owner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.account_state as enum ('active', 'restricted');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.server_state as enum ('requested', 'active', 'paused', 'disconnected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.bot_state as enum ('unknown', 'online', 'offline');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pass_state as enum ('pending', 'paid', 'rejected', 'refunded', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_state as enum ('pending', 'paid', 'rejected', 'refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ticket_state as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.room_kind as enum ('support', 'staff', 'pass', 'server');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique,
  username text,
  display_name text,
  avatar_url text,
  account_status public.account_state not null default 'active',
  notification_preferences jsonb not null default '{"email":false,"inApp":true}'::jsonb,
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  first_login_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.tend_role not null default 'user',
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists user_roles_single_owner on public.user_roles ((role)) where role = 'owner';

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  discord_server_id text not null unique check (discord_server_id ~ '^[0-9]{15,22}$'),
  name text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  status public.server_state not null default 'requested',
  bot_status public.bot_state not null default 'unknown',
  bot_checked_at timestamptz,
  managed_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.server_memberships (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null default 'requester' check (membership_role in ('requester', 'manager')),
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'revoked')),
  verified_manage_permission boolean not null default false,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (server_id, user_id)
);
create index if not exists server_memberships_user_idx on public.server_memberships(user_id, status);

create table if not exists public.server_settings (
  server_id uuid primary key references public.servers(id) on delete cascade,
  settings jsonb not null default '{"automod":{"spam":false,"repeatedMessages":false,"inviteLinks":false,"externalLinks":false,"mentionSpam":false,"newAccountLimit":false}}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_words (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  word text not null check (length(trim(word)) between 1 and 100),
  action jsonb not null default '{"deleteMessage":true,"warningCount":1,"timeoutSeconds":0,"exceptRoleIds":[],"exceptChannelIds":[]}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (server_id, word)
);
create index if not exists blocked_words_server_idx on public.blocked_words(server_id);

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  actor_discord_id text,
  target_discord_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  result text not null default 'unknown',
  created_at timestamptz not null default now()
);
create index if not exists moderation_logs_server_date_idx on public.moderation_logs(server_id, created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references public.servers(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(body) <= 20000),
  accent text not null default 'blue',
  image_path text,
  link_data jsonb not null default '[]'::jsonb,
  channel_id text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'failed', 'deleted')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_published_idx on public.announcements(status, published_at desc);

create table if not exists public.announcement_schedules (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  scheduled_at timestamptz not null,
  repeat_rule text,
  status text not null default 'scheduled' check (status in ('scheduled', 'running', 'completed', 'failed', 'cancelled')),
  last_result jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists announcement_schedules_due_idx on public.announcement_schedules(status, scheduled_at);

create table if not exists public.pass_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_days integer not null check (duration_days in (1, 10, 30)),
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.pass_products(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  server_id uuid not null references public.servers(id) on delete restrict,
  status public.pass_state not null default 'pending',
  starts_at timestamptz,
  expires_at timestamptz,
  management_status text not null default 'inactive' check (management_status in ('inactive', 'pending', 'active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists passes_owner_idx on public.passes(owner_id, created_at desc);
create index if not exists passes_expiry_idx on public.passes(status, expires_at);
create unique index if not exists passes_single_pending_server_owner on public.passes(owner_id, server_id) where status = 'pending';

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.passes(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  status public.payment_state not null default 'pending',
  payment_reference text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_status_date_idx on public.payments(status, created_at desc);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (length(trim(subject)) between 1 and 200),
  category text not null default 'support' check (category in ('support', 'pass', 'server')),
  status public.ticket_state not null default 'open',
  assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists tickets_requester_idx on public.tickets(requester_id, updated_at desc);
create index if not exists tickets_queue_idx on public.tickets(status, updated_at desc);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  kind public.room_kind not null default 'support',
  title text not null,
  ticket_id uuid unique references public.tickets(id) on delete cascade,
  server_id uuid references public.servers(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_rooms_recent_idx on public.chat_rooms(updated_at desc);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_read_at timestamptz,
  primary key (room_id, user_id)
);
create index if not exists chat_room_members_user_idx on public.chat_room_members(user_id, left_at);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null default '' check (length(body) <= 10000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (length(body) > 0 or deleted_at is not null)
);
create index if not exists chat_messages_room_date_idx on public.chat_messages(room_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  result text not null default 'success',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_date_idx on public.audit_logs(created_at desc);

create table if not exists public.service_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_discord_id text;
  v_username text;
  v_display_name text;
  v_avatar text;
begin
  v_discord_id := coalesce(
    new.raw_user_meta_data ->> 'sub',
    new.raw_user_meta_data ->> 'provider_id',
    (select i.provider_id from auth.identities i where i.user_id = new.id and i.provider = 'discord' limit 1)
  );
  v_username := coalesce(new.raw_user_meta_data ->> 'preferred_username', new.raw_user_meta_data ->> 'username');
  v_display_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', v_username);
  v_avatar := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');

  insert into public.profiles(id, discord_id, username, display_name, avatar_url, first_login_at, last_login_at)
  values (new.id, v_discord_id, v_username, v_display_name, v_avatar, coalesce(new.created_at, now()), coalesce(new.last_sign_in_at, now()))
  on conflict (id) do update set
    discord_id = coalesce(excluded.discord_id, public.profiles.discord_id),
    username = coalesce(excluded.username, public.profiles.username),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    last_login_at = coalesce(new.last_sign_in_at, public.profiles.last_login_at);

  insert into public.user_roles(user_id, role) values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_profile on auth.users;
create trigger on_auth_user_sync_profile after insert or update of raw_user_meta_data, last_sign_in_at on auth.users
for each row execute function public.sync_auth_profile();

create or replace function private.has_role(p_user uuid, p_role public.tend_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = p_user and role = p_role)
$$;

create or replace function private.is_staff_or_owner(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select private.has_role(p_user, 'staff') or private.has_role(p_user, 'owner')
$$;

create or replace function private.is_server_member(p_server uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.server_memberships sm
    where sm.server_id = p_server and sm.user_id = p_user and sm.status = 'active'
  )
$$;

create or replace function private.can_manage_server(p_server uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select private.is_staff_or_owner(p_user) or exists (
    select 1
    from public.server_memberships sm
    join public.servers s on s.id = sm.server_id
    where sm.server_id = p_server and sm.user_id = p_user
      and sm.status = 'active' and sm.membership_role = 'manager'
      and sm.verified_manage_permission = true and s.status = 'active'
      and exists (
        select 1 from public.passes p
        where p.server_id = s.id and p.status = 'paid' and p.expires_at > now()
      )
  )
$$;

create or replace function private.can_access_room(p_room uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_room_members crm
    where crm.room_id = p_room and crm.user_id = p_user and crm.left_at is null
  ) or private.has_role(p_user, 'staff')
$$;

create or replace function private.can_view_profile(p_target uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_target = p_user or private.is_staff_or_owner(p_user) or exists (
    select 1
    from public.chat_room_members mine
    join public.chat_room_members theirs on theirs.room_id = mine.room_id
    where mine.user_id = p_user and mine.left_at is null
      and theirs.user_id = p_target and theirs.left_at is null
  )
$$;

grant execute on function private.has_role(uuid, public.tend_role) to authenticated;
grant execute on function private.is_staff_or_owner(uuid) to authenticated;
grant execute on function private.is_server_member(uuid, uuid) to authenticated;
grant execute on function private.can_manage_server(uuid, uuid) to authenticated;
grant execute on function private.can_access_room(uuid, uuid) to authenticated;
grant execute on function private.can_view_profile(uuid, uuid) to authenticated;

create or replace function public.request_server_registration(p_discord_server_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_server uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_discord_server_id !~ '^[0-9]{15,22}$' then raise exception 'Invalid Discord server ID'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active') then
    raise exception 'Account is restricted';
  end if;

  select id into v_server from public.servers where discord_server_id = p_discord_server_id;
  if v_server is null then
    insert into public.servers(discord_server_id, created_by, status, bot_status)
    values (p_discord_server_id, auth.uid(), 'requested', 'unknown')
    returning id into v_server;
  end if;
  insert into public.server_memberships(server_id, user_id, membership_role, status, verified_manage_permission)
  values (v_server, auth.uid(), 'requester', 'pending', false)
  on conflict (server_id, user_id) do update set
    status = case when public.server_memberships.status = 'cancelled' then 'pending' else public.server_memberships.status end,
    updated_at = now();
  return v_server;
end;
$$;

create or replace function public.cancel_server_registration(p_server uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_deleted integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.server_memberships
    set status = 'cancelled', updated_at = now()
  where server_id = p_server and user_id = auth.uid() and status = 'pending';
  if not found then return false; end if;

  delete from public.servers s
  where s.id = p_server and s.created_by = auth.uid() and s.status = 'requested'
    and not exists (
      select 1 from public.server_memberships sm
      where sm.server_id = s.id and sm.status <> 'cancelled'
    );
  get diagnostics v_deleted = row_count;
  return true;
end;
$$;

create or replace function public.request_pass(p_product uuid, p_server uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_pass uuid;
  v_price numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active') then
    raise exception 'Account is restricted';
  end if;
  select price into v_price from public.pass_products where id = p_product and active = true;
  if v_price is null then raise exception 'Pass product is unavailable'; end if;
  if not exists (
    select 1 from public.servers s
    where s.id = p_server and (
      s.created_by = auth.uid() or exists (
        select 1 from public.server_memberships sm
        where sm.server_id = s.id and sm.user_id = auth.uid() and sm.status in ('pending','active')
      )
    )
  ) then raise exception 'Server access is not verified'; end if;

  insert into public.passes(product_id, owner_id, server_id, status, management_status)
  values (p_product, auth.uid(), p_server, 'pending', 'inactive')
  returning id into v_pass;
  insert into public.payments(pass_id, requester_id, amount, status)
  values (v_pass, auth.uid(), v_price, 'pending');
  return v_pass;
end;
$$;

create or replace function public.create_support_ticket(p_subject text, p_message text, p_category text default 'support')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_ticket uuid;
  v_room uuid;
  v_kind public.room_kind;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_subject)) not between 1 and 200 then raise exception 'Invalid subject'; end if;
  if length(trim(p_message)) not between 1 and 10000 then raise exception 'Invalid message'; end if;
  if p_category not in ('support', 'pass', 'server') then raise exception 'Invalid category'; end if;
  v_kind := case p_category when 'pass' then 'pass'::public.room_kind when 'server' then 'server'::public.room_kind else 'support'::public.room_kind end;

  insert into public.tickets(requester_id, subject, category) values (auth.uid(), trim(p_subject), p_category) returning id into v_ticket;
  insert into public.chat_rooms(kind, title, ticket_id, created_by) values (v_kind, trim(p_subject), v_ticket, auth.uid()) returning id into v_room;
  insert into public.chat_room_members(room_id, user_id) values (v_room, auth.uid());
  insert into public.chat_messages(room_id, author_id, body) values (v_room, auth.uid(), trim(p_message));
  return v_ticket;
end;
$$;

create or replace function public.soft_delete_own_chat_message(p_message uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.chat_messages set body = '', deleted_at = now(), edited_at = now()
  where id = p_message and author_id = auth.uid() and deleted_at is null
    and created_at > now() - interval '15 minutes';
  return found;
end;
$$;

create or replace function public.edit_own_chat_message(p_message uuid, p_body text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_body)) not between 1 and 10000 then raise exception 'Invalid message'; end if;
  update public.chat_messages set body = trim(p_body), edited_at = now()
  where id = p_message and author_id = auth.uid() and deleted_at is null
    and created_at > now() - interval '15 minutes';
  return found;
end;
$$;

create or replace function public.mark_room_read(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.chat_room_members set last_read_at = now()
  where room_id = p_room and user_id = auth.uid() and left_at is null;
end;
$$;

create or replace function public.owner_read_ticket(p_ticket uuid)
returns setof public.tickets language plpgsql security definer set search_path = public as $$
begin
  if not private.has_role(auth.uid(), 'owner') then raise exception 'Owner access required'; end if;
  insert into public.audit_logs(actor_id, action, target_type, target_id)
    values (auth.uid(), 'ticket.read', 'ticket', p_ticket::text);
  return query select * from public.tickets where id = p_ticket;
end;
$$;

create or replace function public.owner_dashboard_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not private.has_role(auth.uid(), 'owner') then raise exception 'Owner access required'; end if;
  return jsonb_build_object(
    'userCount', (select count(*) from public.profiles),
    'todayLoginCount', (select count(*) from public.profiles where last_login_at >= date_trunc('day', now())),
    'serverCount', (select count(*) from public.servers),
    'managedServerCount', (select count(*) from public.servers where status = 'active'),
    'activePassCount', (select count(*) from public.passes where status = 'paid' and expires_at > now()),
    'expiringPassCount', (select count(*) from public.passes where status = 'paid' and expires_at >= now() and expires_at < now() + interval '7 days'),
    'pendingPaymentCount', (select count(*) from public.payments where status = 'pending'),
    'openTicketCount', (select count(*) from public.tickets where status in ('open','in_progress'))
  );
end;
$$;

revoke all on function public.create_support_ticket(text, text, text) from public;
revoke all on function public.request_server_registration(text) from public;
revoke all on function public.cancel_server_registration(uuid) from public;
revoke all on function public.request_pass(uuid, uuid) from public;
revoke all on function public.soft_delete_own_chat_message(uuid) from public;
revoke all on function public.edit_own_chat_message(uuid, text) from public;
revoke all on function public.mark_room_read(uuid) from public;
revoke all on function public.owner_read_ticket(uuid) from public;
revoke all on function public.owner_dashboard_summary() from public;
grant execute on function public.create_support_ticket(text, text, text) to authenticated;
grant execute on function public.request_server_registration(text) to authenticated;
grant execute on function public.cancel_server_registration(uuid) to authenticated;
grant execute on function public.request_pass(uuid, uuid) to authenticated;
grant execute on function public.soft_delete_own_chat_message(uuid) to authenticated;
grant execute on function public.edit_own_chat_message(uuid, text) to authenticated;
grant execute on function public.mark_room_read(uuid) to authenticated;
grant execute on function public.owner_read_ticket(uuid) to authenticated;
grant execute on function public.owner_dashboard_summary() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','user_roles','servers','server_memberships','server_settings','blocked_words',
    'moderation_logs','announcements','announcement_schedules','pass_products','passes','payments',
    'tickets','chat_rooms','chat_room_members','chat_messages','notifications','audit_logs','service_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "profiles select permitted users" on public.profiles for select to authenticated
using (private.can_view_profile(id));
create policy "profiles update preferences" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (notification_preferences, theme) on public.profiles to authenticated;

create policy "roles read self or staff" on public.user_roles for select to authenticated
using (user_id = auth.uid() or private.is_staff_or_owner());

create policy "servers select members or staff" on public.servers for select to authenticated
using (created_by = auth.uid() or private.is_server_member(id) or exists(select 1 from public.server_memberships sm where sm.server_id = id and sm.user_id = auth.uid()) or private.is_staff_or_owner());
create policy "servers request own" on public.servers for insert to authenticated
with check (created_by = auth.uid() and status = 'requested' and bot_status = 'unknown' and managed_since is null);

create policy "server memberships select own or managers" on public.server_memberships for select to authenticated
using (user_id = auth.uid() or private.can_manage_server(server_id) or private.is_staff_or_owner());
create policy "server memberships request self" on public.server_memberships for insert to authenticated
with check (user_id = auth.uid() and membership_role = 'requester' and status = 'pending' and verified_manage_permission = false);
create policy "server memberships cancel own request" on public.server_memberships for update to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'cancelled' and membership_role = 'requester' and verified_manage_permission = false);
create policy "server memberships staff manage" on public.server_memberships for update to authenticated
using (private.is_staff_or_owner()) with check (private.is_staff_or_owner());

create policy "server settings select members" on public.server_settings for select to authenticated
using (private.is_server_member(server_id) or private.can_manage_server(server_id));
create policy "server settings manage verified" on public.server_settings for all to authenticated
using (private.can_manage_server(server_id)) with check (private.can_manage_server(server_id));

create policy "blocked words select managers" on public.blocked_words for select to authenticated
using (private.can_manage_server(server_id));
create policy "blocked words manage verified" on public.blocked_words for all to authenticated
using (private.can_manage_server(server_id)) with check (private.can_manage_server(server_id) and created_by = auth.uid());

create policy "moderation logs read managers" on public.moderation_logs for select to authenticated
using (private.can_manage_server(server_id));

create policy "announcements public published or managers" on public.announcements for select to authenticated
using ((status = 'published' and (server_id is null or private.is_server_member(server_id))) or private.is_staff_or_owner() or (server_id is not null and private.can_manage_server(server_id)));
create policy "announcements manage staff" on public.announcements for all to authenticated
using (private.is_staff_or_owner() or (server_id is not null and private.can_manage_server(server_id)))
with check (author_id = auth.uid() and (private.is_staff_or_owner() or (server_id is not null and private.can_manage_server(server_id))));
create policy "announcement schedules staff read" on public.announcement_schedules for select to authenticated
using (private.is_staff_or_owner());
create policy "announcement schedules staff write" on public.announcement_schedules for all to authenticated
using (private.is_staff_or_owner()) with check (private.is_staff_or_owner() and created_by = auth.uid());

create policy "products select active or staff" on public.pass_products for select to authenticated
using (active or private.is_staff_or_owner());
create policy "products staff manage" on public.pass_products for all to authenticated
using (private.is_staff_or_owner()) with check (private.is_staff_or_owner());

create policy "passes select own or staff" on public.passes for select to authenticated
using (owner_id = auth.uid() or private.is_staff_or_owner());
create policy "passes request own pending" on public.passes for insert to authenticated
with check (owner_id = auth.uid() and status = 'pending' and management_status = 'inactive' and starts_at is null and expires_at is null);

create policy "payments select own or staff" on public.payments for select to authenticated
using (requester_id = auth.uid() or private.is_staff_or_owner());
create policy "payments request own pending" on public.payments for insert to authenticated
with check (requester_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);

create policy "tickets select requester or staff" on public.tickets for select to authenticated
using (requester_id = auth.uid() or private.has_role(auth.uid(), 'staff'));
create policy "tickets requester create" on public.tickets for insert to authenticated
with check (requester_id = auth.uid() and status = 'open' and assignee_id is null);
create policy "tickets staff update" on public.tickets for update to authenticated
using (private.is_staff_or_owner()) with check (private.is_staff_or_owner());

create policy "rooms select member" on public.chat_rooms for select to authenticated
using (private.can_access_room(id));
create policy "rooms create self support" on public.chat_rooms for insert to authenticated
with check (created_by = auth.uid() and kind = 'support' and ticket_id is null);
create policy "room members select self or staff" on public.chat_room_members for select to authenticated
using (user_id = auth.uid() or private.is_staff_or_owner());
create policy "room members join self" on public.chat_room_members for insert to authenticated
with check (
  user_id = auth.uid() and left_at is null and (
    exists(select 1 from public.chat_rooms r where r.id = room_id and r.created_by = auth.uid() and r.ticket_id is null)
    or private.has_role(auth.uid(), 'staff')
  )
);
create policy "room members leave self" on public.chat_room_members for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_target text;
begin
  v_before := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_target := coalesce(v_after ->> 'id', v_before ->> 'id', v_after ->> 'user_id',
                       v_before ->> 'user_id', v_after ->> 'server_id', v_before ->> 'server_id',
                       v_after ->> 'ticket_id', v_before ->> 'ticket_id');
  insert into public.audit_logs(actor_id, action, target_type, target_id, before_value, after_value, result)
  values (auth.uid(), lower(tg_table_name) || '.' || lower(tg_op), tg_table_name, v_target, v_before, v_after, 'success');
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists audit_servers_change on public.servers;
create trigger audit_servers_change after insert or update or delete on public.servers
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_server_memberships_change on public.server_memberships;
create trigger audit_server_memberships_change after insert or update or delete on public.server_memberships
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_server_settings_change on public.server_settings;
create trigger audit_server_settings_change after insert or update or delete on public.server_settings
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_blocked_words_change on public.blocked_words;
create trigger audit_blocked_words_change after insert or update or delete on public.blocked_words
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_announcements_change on public.announcements;
create trigger audit_announcements_change after insert or update or delete on public.announcements
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_announcement_schedules_change on public.announcement_schedules;
create trigger audit_announcement_schedules_change after insert or update or delete on public.announcement_schedules
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_pass_products_change on public.pass_products;
create trigger audit_pass_products_change after insert or update or delete on public.pass_products
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_passes_change on public.passes;
create trigger audit_passes_change after insert or update or delete on public.passes
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_payments_change on public.payments;
create trigger audit_payments_change after insert or update or delete on public.payments
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_tickets_change on public.tickets;
create trigger audit_tickets_change after insert or update or delete on public.tickets
for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_service_settings_change on public.service_settings;
create trigger audit_service_settings_change after insert or update or delete on public.service_settings
for each row execute function public.audit_sensitive_change();

grant select on public.profiles, public.user_roles, public.servers, public.server_memberships,
  public.server_settings, public.blocked_words, public.moderation_logs, public.announcements,
  public.announcement_schedules, public.pass_products, public.passes, public.payments,
  public.tickets, public.chat_rooms, public.chat_room_members, public.chat_messages,
  public.notifications, public.audit_logs, public.service_settings to authenticated;
grant insert on public.server_settings, public.blocked_words, public.announcements, public.announcement_schedules,
  public.chat_rooms, public.chat_room_members, public.chat_messages, public.notifications to authenticated;
grant update on public.server_settings, public.blocked_words, public.announcements,
  public.announcement_schedules, public.tickets, public.service_settings to authenticated;
grant delete on public.server_settings, public.blocked_words, public.announcements,
  public.announcement_schedules to authenticated;
grant update (status) on public.server_memberships to authenticated;
grant update (left_at, last_read_at) on public.chat_room_members to authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update on public.profiles from authenticated;
grant update (notification_preferences, theme) on public.profiles to authenticated;
revoke update on public.chat_messages from authenticated;

create policy "messages select members" on public.chat_messages for select to authenticated
using (private.can_access_room(room_id));
create policy "messages send as self" on public.chat_messages for insert to authenticated
with check (author_id = auth.uid() and private.can_access_room(room_id) and deleted_at is null);
create policy "messages edit own" on public.chat_messages for update to authenticated
using (author_id = auth.uid() and deleted_at is null and created_at > now() - interval '15 minutes')
with check (author_id = auth.uid() and deleted_at is null);

create policy "notifications own read" on public.notifications for select to authenticated
using (user_id = auth.uid());
create policy "notifications own mark read" on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "audit logs owner read" on public.audit_logs for select to authenticated
using (private.has_role(auth.uid(), 'owner'));

create policy "service settings read" on public.service_settings for select to authenticated
using (key in ('maintenance_enabled', 'maintenance_message') or private.is_staff_or_owner());
create policy "service settings staff update" on public.service_settings for all to authenticated
using (private.is_staff_or_owner()) with check (private.is_staff_or_owner());

do $$ begin
  create publication supabase_realtime;
exception when duplicate_object then null; end $$;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_rooms;
alter publication supabase_realtime add table public.notifications;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('tend-chat-attachments', 'tend-chat-attachments', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain'])
on conflict (id) do nothing;

create policy "room members upload attachments" on storage.objects for insert to authenticated
with check (
  bucket_id = 'tend-chat-attachments'
  and private.can_access_room(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','pdf','txt')
);
create policy "room members read attachments" on storage.objects for select to authenticated
using (bucket_id = 'tend-chat-attachments' and private.can_access_room(((storage.foldername(name))[1])::uuid));
create policy "room members delete own room attachments" on storage.objects for delete to authenticated
using (
  bucket_id = 'tend-chat-attachments'
  and private.can_access_room(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = auth.uid()::text
);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger servers_updated_at before update on public.servers for each row execute function public.set_updated_at();
create trigger server_settings_updated_at before update on public.server_settings for each row execute function public.set_updated_at();
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();
create trigger pass_products_updated_at before update on public.pass_products for each row execute function public.set_updated_at();
create trigger passes_updated_at before update on public.passes for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger tickets_updated_at before update on public.tickets for each row execute function public.set_updated_at();
create trigger chat_rooms_updated_at before update on public.chat_rooms for each row execute function public.set_updated_at();
create trigger service_settings_updated_at before update on public.service_settings for each row execute function public.set_updated_at();
