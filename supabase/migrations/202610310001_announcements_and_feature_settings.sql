create extension if not exists pgcrypto;

create table if not exists public.bot_announcements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  server_id text not null check (server_id ~ '^[0-9]{5,30}$'),
  title text,
  content text not null,
  image_url text,
  channel_id text,
  status text not null default 'queued' check (status in ('queued','sent','failed','deleted')),
  error_message text,
  discord_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_announcements_server_created_idx
  on public.bot_announcements(server_id, created_at desc);

alter table public.bot_announcements enable row level security;
drop policy if exists "TEND users can view their server announcements" on public.bot_announcements;
create policy "TEND users can view their server announcements"
  on public.bot_announcements for select to authenticated
  using (exists (
    select 1 from public.purchase_requests p
    where p.server_id = bot_announcements.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  ));
drop policy if exists "TEND users can update their server announcements" on public.bot_announcements;
create policy "TEND users can update their server announcements"
  on public.bot_announcements for update to authenticated
  using (exists (
    select 1 from public.purchase_requests p
    where p.server_id = bot_announcements.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  ))
  with check (exists (
    select 1 from public.purchase_requests p
    where p.server_id = bot_announcements.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  ));
grant select, update on public.bot_announcements to authenticated;

create table if not exists public.server_feature_settings (
  server_id text not null check (server_id ~ '^[0-9]{5,30}$'),
  feature_key text not null check (feature_key in (
    'tickets','polls','welcome','goodbye','auto_roles','reaction_roles',
    'auto_responses','link_filter','anti_spam','account_security',
    'server_logs','warnings','temporary_voice','server_backup'
  )),
  settings jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (server_id, feature_key)
);

alter table public.server_feature_settings enable row level security;
drop policy if exists "TEND users can view their server feature settings" on public.server_feature_settings;
create policy "TEND users can view their server feature settings"
  on public.server_feature_settings for select to authenticated
  using (exists (
    select 1 from public.purchase_requests p
    where p.server_id = server_feature_settings.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  ));
drop policy if exists "TEND users can insert their server feature settings" on public.server_feature_settings;
create policy "TEND users can insert their server feature settings"
  on public.server_feature_settings for insert to authenticated
  with check (exists (
    select 1 from public.purchase_requests p
    where p.server_id = server_feature_settings.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  ));
drop policy if exists "TEND users can update their server feature settings" on public.server_feature_settings;
create policy "TEND users can update their server feature settings"
  on public.server_feature_settings for update to authenticated
  using (exists (
    select 1 from public.purchase_requests p
    where p.server_id = server_feature_settings.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  ))
  with check (exists (
    select 1 from public.purchase_requests p
    where p.server_id = server_feature_settings.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  ));
grant select, insert, update on public.server_feature_settings to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.server_feature_settings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
