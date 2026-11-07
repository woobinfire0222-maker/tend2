create table if not exists public.lab_server_stats_daily (
  server_id text not null,
  stat_date date not null,
  message_count bigint not null default 0,
  member_count integer not null default 0,
  joins integer not null default 0,
  leaves integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (server_id, stat_date)
);

create table if not exists public.lab_level_members (
  server_id text not null,
  discord_user_id text not null,
  display_name text,
  level integer not null default 0,
  xp bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (server_id, discord_user_id)
);

alter table public.lab_server_stats_daily enable row level security;
alter table public.lab_level_members enable row level security;

drop policy if exists "lab stats readable by server owners" on public.lab_server_stats_daily;
create policy "lab stats readable by server owners"
on public.lab_server_stats_daily for select to authenticated
using (
  exists (
    select 1 from public.purchase_requests p
    where p.server_id = lab_server_stats_daily.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  )
);

drop policy if exists "lab levels readable by server owners" on public.lab_level_members;
create policy "lab levels readable by server owners"
on public.lab_level_members for select to authenticated
using (
  exists (
    select 1 from public.purchase_requests p
    where p.server_id = lab_level_members.server_id
      and p.user_id = auth.uid()
      and p.status in ('approved','completed')
  )
);

grant select on public.lab_server_stats_daily to authenticated;
grant select on public.lab_level_members to authenticated;
