-- TEND manual Discord inventory refresh: guild metadata, channels, roles and emoji/sticker counts.
alter table public.discord_guilds add column if not exists owner_id text;
alter table public.discord_guilds add column if not exists description text;
alter table public.discord_guilds add column if not exists approximate_member_count integer;
alter table public.discord_guilds add column if not exists approximate_presence_count integer;
alter table public.discord_guilds add column if not exists verification_level integer;
alter table public.discord_guilds add column if not exists preferred_locale text;
alter table public.discord_guilds add column if not exists premium_tier integer;
alter table public.discord_guilds add column if not exists premium_subscription_count integer;
alter table public.discord_guilds add column if not exists features jsonb not null default '[]'::jsonb;
alter table public.discord_guilds add column if not exists channel_count integer not null default 0;
alter table public.discord_guilds add column if not exists role_count integer not null default 0;
alter table public.discord_guilds add column if not exists emoji_count integer not null default 0;
alter table public.discord_guilds add column if not exists sticker_count integer not null default 0;

alter table public.discord_channels add column if not exists position integer not null default 0;
alter table public.discord_channels add column if not exists parent_id text;
alter table public.discord_channels add column if not exists topic text;
alter table public.discord_channels add column if not exists is_nsfw boolean not null default false;
alter table public.discord_channels add column if not exists bitrate integer;
alter table public.discord_channels add column if not exists user_limit integer;

create table if not exists public.discord_roles (
  role_id text primary key check (role_id ~ '^[0-9]{5,30}$'),
  server_id text not null references public.discord_guilds(server_id) on delete cascade,
  role_name text not null,
  color integer not null default 0,
  position integer not null default 0,
  permissions text not null default '0',
  hoist boolean not null default false,
  mentionable boolean not null default false,
  managed boolean not null default false,
  synced_at timestamptz not null default now()
);
create index if not exists discord_roles_server_idx on public.discord_roles(server_id);

alter table public.discord_roles enable row level security;
drop policy if exists "Users can read approved Discord role inventory" on public.discord_roles;
create policy "Users can read approved Discord role inventory" on public.discord_roles for select to authenticated
using (exists (select 1 from public.purchase_requests p where p.user_id=auth.uid() and p.server_id=discord_roles.server_id and p.status in ('approved','completed')));

do $$ begin
  alter publication supabase_realtime add table public.discord_roles;
exception when duplicate_object then null;
end $$;
