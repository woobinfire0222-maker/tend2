-- TEND Supabase schema (run in Supabase SQL Editor)
-- Browser uses only the anon/publishable key. Never expose service_role in config.js.
create extension if not exists pgcrypto;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('1일','7일','30일')),
  server_name text not null check (char_length(server_name) between 1 and 100),
  server_id text check (server_id is null or server_id ~ '^[0-9]{5,30}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.purchase_requests add column if not exists payment_status text not null default 'unpaid';
alter table public.purchase_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.bot_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  server_id text,
  welcome_enabled boolean not null default false,
  log_enabled boolean not null default false,
  auto_moderation_enabled boolean not null default false,
  log_channel_id text,
  welcome_message text not null default '',
  moderation_level text not null default 'standard' check (moderation_level in ('light','standard','strict')),
  bot_connected boolean not null default false,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.bot_settings add column if not exists server_id text;
alter table public.bot_settings add column if not exists last_seen_at timestamptz;

create table if not exists public.bot_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  server_id text not null,
  command_type text not null check (command_type in ('sync','post_announcement','refresh_roles')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  result text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists bot_commands_status_created_idx on public.bot_commands(status, created_at);

alter table public.purchase_requests enable row level security;
alter table public.bot_settings enable row level security;
alter table public.bot_commands enable row level security;

drop policy if exists "purchase_requests_select_own_or_admin" on public.purchase_requests;
create policy "purchase_requests_select_own_or_admin" on public.purchase_requests for select to authenticated
using (auth.uid() = user_id or (auth.jwt()->'app_metadata'->>'role' = 'admin' and auth.jwt()->'user_metadata'->>'preferred_username' = 'pengin_hi22'));

drop policy if exists "purchase_requests_insert_own" on public.purchase_requests;
create policy "purchase_requests_insert_own" on public.purchase_requests for insert to authenticated
with check (auth.uid() = user_id and status = 'pending' and payment_status = 'unpaid');

drop policy if exists "purchase_requests_update_admin" on public.purchase_requests;
create policy "purchase_requests_update_admin" on public.purchase_requests for update to authenticated
using (auth.jwt()->'app_metadata'->>'role' = 'admin' and auth.jwt()->'user_metadata'->>'preferred_username' = 'pengin_hi22')
with check (auth.jwt()->'app_metadata'->>'role' = 'admin' and auth.jwt()->'user_metadata'->>'preferred_username' = 'pengin_hi22');

drop policy if exists "bot_settings_select_own_or_admin" on public.bot_settings;
create policy "bot_settings_select_own_or_admin" on public.bot_settings for select to authenticated
using (auth.uid() = user_id or (auth.jwt()->'app_metadata'->>'role' = 'admin' and auth.jwt()->'user_metadata'->>'preferred_username' = 'pengin_hi22'));

drop policy if exists "bot_settings_insert_own" on public.bot_settings;
create policy "bot_settings_insert_own" on public.bot_settings for insert to authenticated
with check (auth.uid() = user_id);
drop policy if exists "bot_settings_update_own" on public.bot_settings;
create policy "bot_settings_update_own" on public.bot_settings for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bot_commands_select_own" on public.bot_commands;
create policy "bot_commands_select_own" on public.bot_commands for select to authenticated
using (auth.uid() = user_id or (auth.jwt()->'app_metadata'->>'role' = 'admin' and auth.jwt()->'user_metadata'->>'preferred_username' = 'pengin_hi22'));
drop policy if exists "bot_commands_insert_own" on public.bot_commands;
create policy "bot_commands_insert_own" on public.bot_commands for insert to authenticated
with check (auth.uid() = user_id and status = 'queued');

-- Bot worker uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in its server environment only.
-- It polls queued bot_commands, performs Discord actions, and updates status/result.
-- It also updates bot_settings.bot_connected and last_seen_at as a heartbeat.
