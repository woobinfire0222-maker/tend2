-- TEND Discord server/channel inventory + Realtime feature settings.
-- Run this once in Supabase SQL Editor before using auto-detection.

create table if not exists public.discord_guilds (
  server_id text primary key check (server_id ~ '^[0-9]{5,30}$'),
  server_name text not null,
  icon_url text,
  bot_present boolean not null default true,
  synced_at timestamptz not null default now()
);

create table if not exists public.discord_channels (
  channel_id text primary key check (channel_id ~ '^[0-9]{5,30}$'),
  server_id text not null references public.discord_guilds(server_id) on delete cascade,
  channel_name text not null,
  channel_type text not null default 'text',
  can_send boolean not null default false,
  synced_at timestamptz not null default now()
);
create index if not exists discord_channels_server_idx on public.discord_channels(server_id);

create table if not exists public.server_feature_settings (
  server_id text not null,
  feature_key text not null,
  settings jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (server_id, feature_key)
);
alter table public.server_feature_settings add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.server_feature_settings add column if not exists enabled boolean not null default false;
alter table public.server_feature_settings add column if not exists updated_at timestamptz not null default now();

alter table public.discord_guilds enable row level security;
alter table public.discord_channels enable row level security;
alter table public.server_feature_settings enable row level security;

drop policy if exists "Users can read approved Discord guild inventory" on public.discord_guilds;
create policy "Users can read approved Discord guild inventory" on public.discord_guilds for select to authenticated
using (exists (select 1 from public.purchase_requests p where p.user_id=auth.uid() and p.server_id=discord_guilds.server_id and p.status in ('approved','completed')));

drop policy if exists "Users can read approved Discord channel inventory" on public.discord_channels;
create policy "Users can read approved Discord channel inventory" on public.discord_channels for select to authenticated
using (exists (select 1 from public.purchase_requests p where p.user_id=auth.uid() and p.server_id=discord_channels.server_id and p.status in ('approved','completed')));

drop policy if exists "Users can read approved server feature settings" on public.server_feature_settings;
create policy "Users can read approved server feature settings" on public.server_feature_settings for select to authenticated
using (exists (select 1 from public.purchase_requests p where p.user_id=auth.uid() and p.server_id=server_feature_settings.server_id and p.status in ('approved','completed')));

drop policy if exists "Users can change approved server feature settings" on public.server_feature_settings;
create policy "Users can change approved server feature settings" on public.server_feature_settings for all to authenticated
using (exists (select 1 from public.purchase_requests p where p.user_id=auth.uid() and p.server_id=server_feature_settings.server_id and p.status in ('approved','completed')))
with check (exists (select 1 from public.purchase_requests p where p.user_id=auth.uid() and p.server_id=server_feature_settings.server_id and p.status in ('approved','completed')));

do $$ begin
  alter publication supabase_realtime add table public.discord_guilds;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.discord_channels;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.server_feature_settings;
exception when duplicate_object then null;
end $$;
