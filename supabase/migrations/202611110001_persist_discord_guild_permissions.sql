create table if not exists public.discord_user_guilds (
  user_id uuid not null references auth.users(id) on delete cascade,
  guild_id text not null check (guild_id ~ '^[0-9]{17,20}$'),
  guild_name text not null default '',
  is_owner boolean not null default false,
  permissions text not null default '0',
  can_manage boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, guild_id)
);

create index if not exists discord_user_guilds_user_synced_idx
  on public.discord_user_guilds (user_id, synced_at desc);

alter table public.discord_user_guilds enable row level security;
revoke all on public.discord_user_guilds from anon, authenticated;
grant select on public.discord_user_guilds to authenticated;

drop policy if exists discord_user_guilds_select_own on public.discord_user_guilds;
create policy discord_user_guilds_select_own
  on public.discord_user_guilds
  for select to authenticated
  using (user_id = (select auth.uid()));
