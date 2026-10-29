-- TEND database setup. Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default '1일',
  server_name text not null default '',
  server_id text,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.purchase_requests add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.purchase_requests add column if not exists plan text not null default '1일';
alter table public.purchase_requests add column if not exists server_name text not null default '';
alter table public.purchase_requests add column if not exists server_id text;
alter table public.purchase_requests add column if not exists status text not null default 'pending';
alter table public.purchase_requests add column if not exists payment_status text not null default 'unpaid';
alter table public.purchase_requests add column if not exists rejection_reason text not null default '';
alter table public.purchase_requests add column if not exists created_at timestamptz not null default now();
alter table public.purchase_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.bot_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  server_id text,
  welcome_enabled boolean not null default false,
  log_enabled boolean not null default false,
  auto_moderation_enabled boolean not null default false,
  log_channel_id text,
  welcome_message text not null default '',
  moderation_level text not null default 'standard',
  bot_connected boolean not null default false,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.bot_settings add column if not exists server_id text;
alter table public.bot_settings add column if not exists welcome_enabled boolean not null default false;
alter table public.bot_settings add column if not exists log_enabled boolean not null default false;
alter table public.bot_settings add column if not exists auto_moderation_enabled boolean not null default false;
alter table public.bot_settings add column if not exists log_channel_id text;
alter table public.bot_settings add column if not exists welcome_message text not null default '';
alter table public.bot_settings add column if not exists moderation_level text not null default 'standard';
alter table public.bot_settings add column if not exists bot_connected boolean not null default false;
alter table public.bot_settings add column if not exists last_seen_at timestamptz;
alter table public.bot_settings add column if not exists updated_at timestamptz not null default now();

create table if not exists public.bot_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  server_id text not null,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  result text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.bot_commands add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.bot_commands add column if not exists server_id text;
alter table public.bot_commands add column if not exists command_type text;
alter table public.bot_commands add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.bot_commands add column if not exists status text not null default 'queued';
alter table public.bot_commands add column if not exists result text;
alter table public.bot_commands add column if not exists created_at timestamptz not null default now();
alter table public.bot_commands add column if not exists processed_at timestamptz;
create index if not exists bot_commands_status_created_idx on public.bot_commands(status, created_at);

alter table public.purchase_requests enable row level security;
alter table public.bot_settings enable row level security;
alter table public.bot_commands enable row level security;

-- Remove older policies on these application tables before recreating the intended rules.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('purchase_requests', 'bot_settings', 'bot_commands')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

grant select, insert, update on public.purchase_requests to authenticated;
grant select, insert, update on public.bot_settings to authenticated;
grant select, insert on public.bot_commands to authenticated;

create policy purchase_requests_select_own_or_admin
on public.purchase_requests for select to authenticated
using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy purchase_requests_insert_own
on public.purchase_requests for insert to authenticated
with check (auth.uid() = user_id and status = 'pending' and payment_status = 'unpaid');

create policy purchase_requests_update_admin
on public.purchase_requests for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy bot_settings_select_own_or_admin
on public.bot_settings for select to authenticated
using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy bot_settings_insert_own
on public.bot_settings for insert to authenticated
with check (auth.uid() = user_id);

create policy bot_settings_update_own
on public.bot_settings for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy bot_commands_select_own_or_admin
on public.bot_commands for select to authenticated
using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy bot_commands_insert_own
on public.bot_commands for insert to authenticated
with check (auth.uid() = user_id and status = 'queued');


-- Grant administrator role by the configured Discord user ID.
-- This does not require manually looking up a Supabase UUID.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where
  u.raw_user_meta_data->>'sub' = '1318120987480424498'
  or u.raw_user_meta_data->>'provider_id' = '1318120987480424498'
  or u.raw_user_meta_data->>'id' = '1318120987480424498'
  or u.raw_user_meta_data->>'user_id' = '1318120987480424498'
  or exists (
    select 1 from auth.identities i
    where i.user_id = u.id and (
      i.identity_data->>'sub' = '1318120987480424498'
      or i.identity_data->>'provider_id' = '1318120987480424498'
      or i.identity_data->>'id' = '1318120987480424498'
      or i.identity_data->>'user_id' = '1318120987480424498'
    )
  );

-- Sign out and sign back in after running this file to refresh the session role.


-- TEND server-scoped bot management tables.
create table if not exists public.managed_servers (
  server_id text primary key,
  server_name text not null default '',
  owner_id text not null,
  is_active boolean not null default false,
  started_at timestamptz,
  bot_connected boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.managed_servers add column if not exists started_at timestamptz;
alter table public.managed_servers add column if not exists bot_connected boolean not null default false;
alter table public.managed_servers add column if not exists last_seen_at timestamptz;
alter table public.managed_servers add column if not exists updated_at timestamptz not null default now();

-- Only servers with an approved/completed request can be managed by that signed-in account.
create or replace function public.user_owns_server(target_server_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.purchase_requests pr
    where pr.user_id = auth.uid()
      and pr.server_id = target_server_id
      and pr.status in ('approved', 'completed')
  );
$$;
revoke all on function public.user_owns_server(text) from public;
grant execute on function public.user_owns_server(text) to authenticated;

create table if not exists public.server_feature_settings (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  feature_key text not null,
  settings jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(server_id, feature_key)
);

create table if not exists public.moderation_rules (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  word text not null,
  match_type text not null default 'contains' check (match_type in ('exact','contains')),
  action_type text not null default 'delete' check (action_type in ('ban','timeout','delete')),
  timeout_seconds integer,
  enabled boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (action_type = 'timeout' and timeout_seconds between 1 and 2419200)
    or (action_type <> 'timeout' and timeout_seconds is null)
  )
);
create index if not exists moderation_rules_server_idx on public.moderation_rules(server_id, enabled);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  channel_id text,
  user_id text,
  rule_id uuid references public.moderation_rules(id) on delete set null,
  action_type text not null,
  success boolean not null default false,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.announcement_channels (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  channel_id text not null,
  channel_name text not null default '',
  is_default boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(server_id, channel_id)
);
create unique index if not exists announcement_channels_one_default_idx
on public.announcement_channels(server_id) where is_default = true and enabled = true;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  channel_id text,
  title text not null default '',
  content text not null,
  image_url text,
  status text not null default 'draft' check (status in ('draft','queued','sent','failed','deleted')),
  created_by text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.announcement_mentions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  mention_type text not null check (mention_type in ('everyone','here','role')),
  role_id text,
  check ((mention_type = 'role' and role_id is not null) or (mention_type in ('everyone','here') and role_id is null))
);
create table if not exists public.announcement_deliveries (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  channel_id text,
  discord_message_id text,
  success boolean not null default false,
  error_message text,
  sent_at timestamptz not null default now()
);

create table if not exists public.server_blacklists (
  id uuid primary key default gen_random_uuid(),
  managed_server_id text not null references public.managed_servers(server_id) on delete cascade,
  blocked_server_id text not null,
  invite_url text,
  reason text not null default '등록된 블랙리스트 서버의 구성원입니다.',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(managed_server_id, blocked_server_id)
);
create table if not exists public.user_blacklists (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  discord_user_id text,
  username text,
  reason text not null default '서버 운영 정책에 따라 입장이 제한되었습니다.',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (discord_user_id is not null or username is not null)
);
create index if not exists user_blacklists_server_idx on public.user_blacklists(server_id, enabled);

create table if not exists public.server_audit_logs (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  actor_id text,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_jobs (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_jobs_pending_idx on public.bot_jobs(status, created_at) where status in ('pending','failed');

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  channel_id text,
  opener_id text not null,
  category text not null default '일반 문의',
  status text not null default 'open' check (status in ('open','claimed','closed')),
  assigned_to text,
  transcript_url text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  channel_id text,
  message_id text,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  allow_multiple boolean not null default false,
  anonymous boolean not null default false,
  ends_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id text not null,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  unique(poll_id, user_id, option_index)
);
create table if not exists public.server_warnings (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  user_id text not null,
  moderator_id text,
  reason text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.server_automations (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  automation_type text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists server_automations_lookup_idx on public.server_automations(server_id, automation_type, enabled);
create table if not exists public.server_backups (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.managed_servers(server_id) on delete cascade,
  created_by text,
  backup_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable row-level security for all server-scoped tables.
alter table public.managed_servers enable row level security;
alter table public.server_feature_settings enable row level security;
alter table public.moderation_rules enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.announcement_channels enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_mentions enable row level security;
alter table public.announcement_deliveries enable row level security;
alter table public.server_blacklists enable row level security;
alter table public.user_blacklists enable row level security;
alter table public.server_audit_logs enable row level security;
alter table public.bot_jobs enable row level security;
alter table public.tickets enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.server_warnings enable row level security;
alter table public.server_automations enable row level security;
alter table public.server_backups enable row level security;

-- Remove only policies created by this migration, then recreate them idempotently.
drop policy if exists managed_servers_select_owned on public.managed_servers;
drop policy if exists managed_servers_insert_owned on public.managed_servers;
drop policy if exists managed_servers_update_owned on public.managed_servers;
create policy managed_servers_select_owned on public.managed_servers for select to authenticated using (public.user_owns_server(server_id));
create policy managed_servers_insert_owned on public.managed_servers for insert to authenticated with check (public.user_owns_server(server_id));
create policy managed_servers_update_owned on public.managed_servers for update to authenticated using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists feature_settings_owned_all on public.server_feature_settings;
create policy feature_settings_owned_all on public.server_feature_settings for all to authenticated
using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists moderation_rules_owned_all on public.moderation_rules;
create policy moderation_rules_owned_all on public.moderation_rules for all to authenticated
using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists moderation_actions_select_owned on public.moderation_actions;
create policy moderation_actions_select_owned on public.moderation_actions for select to authenticated using (public.user_owns_server(server_id));

drop policy if exists announcement_channels_owned_all on public.announcement_channels;
create policy announcement_channels_owned_all on public.announcement_channels for all to authenticated
using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists announcements_owned_all on public.announcements;
create policy announcements_owned_all on public.announcements for all to authenticated
using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists announcement_mentions_owned_all on public.announcement_mentions;
create policy announcement_mentions_owned_all on public.announcement_mentions for all to authenticated
using (exists (select 1 from public.announcements a where a.id = announcement_id and public.user_owns_server(a.server_id)))
with check (exists (select 1 from public.announcements a where a.id = announcement_id and public.user_owns_server(a.server_id)));

drop policy if exists announcement_deliveries_select_owned on public.announcement_deliveries;
create policy announcement_deliveries_select_owned on public.announcement_deliveries for select to authenticated
using (exists (select 1 from public.announcements a where a.id = announcement_id and public.user_owns_server(a.server_id)));

drop policy if exists server_blacklists_owned_all on public.server_blacklists;
create policy server_blacklists_owned_all on public.server_blacklists for all to authenticated
using (public.user_owns_server(managed_server_id)) with check (public.user_owns_server(managed_server_id));

drop policy if exists user_blacklists_owned_all on public.user_blacklists;
create policy user_blacklists_owned_all on public.user_blacklists for all to authenticated
using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists server_audit_logs_select_owned on public.server_audit_logs;
create policy server_audit_logs_select_owned on public.server_audit_logs for select to authenticated using (public.user_owns_server(server_id));

drop policy if exists bot_jobs_select_owned on public.bot_jobs;
drop policy if exists bot_jobs_insert_owned on public.bot_jobs;
create policy bot_jobs_select_owned on public.bot_jobs for select to authenticated using (public.user_owns_server(server_id));
create policy bot_jobs_insert_owned on public.bot_jobs for insert to authenticated with check (public.user_owns_server(server_id) and status = 'pending');

drop policy if exists tickets_owned_all on public.tickets;
create policy tickets_owned_all on public.tickets for all to authenticated using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists polls_owned_all on public.polls;
create policy polls_owned_all on public.polls for all to authenticated using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists poll_votes_owned_all on public.poll_votes;
create policy poll_votes_owned_all on public.poll_votes for all to authenticated
using (exists (select 1 from public.polls p where p.id = poll_id and public.user_owns_server(p.server_id)))
with check (exists (select 1 from public.polls p where p.id = poll_id and public.user_owns_server(p.server_id)));

drop policy if exists server_warnings_owned_all on public.server_warnings;
create policy server_warnings_owned_all on public.server_warnings for all to authenticated using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists server_automations_owned_all on public.server_automations;
create policy server_automations_owned_all on public.server_automations for all to authenticated using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

drop policy if exists server_backups_owned_all on public.server_backups;
create policy server_backups_owned_all on public.server_backups for all to authenticated using (public.user_owns_server(server_id)) with check (public.user_owns_server(server_id));

grant select, insert, update on public.managed_servers to authenticated;
grant select, insert, update, delete on public.server_feature_settings to authenticated;
grant select, insert, update, delete on public.moderation_rules to authenticated;
grant select on public.moderation_actions to authenticated;
grant select, insert, update, delete on public.announcement_channels to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, update, delete on public.announcement_mentions to authenticated;
grant select on public.announcement_deliveries to authenticated;
grant select, insert, update, delete on public.server_blacklists to authenticated;
grant select, insert, update, delete on public.user_blacklists to authenticated;
grant select on public.server_audit_logs to authenticated;
grant select, insert on public.bot_jobs to authenticated;
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.polls to authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;
grant select, insert, update, delete on public.server_warnings to authenticated;
grant select, insert, update, delete on public.server_automations to authenticated;
grant select, insert, update, delete on public.server_backups to authenticated;

-- The bot uses a server-side service key. Never expose that key in browser code.
