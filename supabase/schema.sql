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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.purchase_requests add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.purchase_requests add column if not exists plan text not null default '1일';
alter table public.purchase_requests add column if not exists server_name text not null default '';
alter table public.purchase_requests add column if not exists server_id text;
alter table public.purchase_requests add column if not exists status text not null default 'pending';
alter table public.purchase_requests add column if not exists payment_status text not null default 'unpaid';
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

-- Admin access must be granted only to your own verified account UUID.
-- To inspect accounts, run separately: select id, raw_user_meta_data from auth.users;
-- After confirming your Discord account, replace UUID below and run this separately:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where id = 'PASTE_YOUR_VERIFIED_UUID_HERE';
-- Then sign out and sign back in.
