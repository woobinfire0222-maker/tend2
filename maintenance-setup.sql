-- TEND service maintenance and diagnostics
create table if not exists public.tend_service_status (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  message text not null default '더 안정적인 서비스를 제공하기 위해 점검을 진행하고 있어요. 잠시 후 다시 방문해 주세요.',
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.tend_service_status (id, enabled) values (1, false) on conflict (id) do nothing;

create table if not exists public.tend_system_logs (
  id bigint generated always as identity primary key,
  log_type text not null default '시스템',
  severity text not null default 'info' check (severity in ('info','warning','error','critical')),
  location text not null default '알 수 없음',
  message_ko text not null,
  original_message text,
  created_at timestamptz not null default now()
);
create index if not exists tend_system_logs_created_at_idx on public.tend_system_logs(created_at desc);
alter table public.tend_service_status enable row level security;
alter table public.tend_system_logs enable row level security;

create or replace function public.tend_is_admin()
returns boolean language sql stable security definer set search_path=public,auth
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role')='admin',false)
    or coalesce(auth.jwt()->'user_metadata'->>'sub'='1318120987480424498',false)
    or coalesce(auth.jwt()->'user_metadata'->>'provider_id'='1318120987480424498',false)
    or coalesce(auth.jwt()->'user_metadata'->>'discord_id'='1318120987480424498',false);
$$;
grant execute on function public.tend_is_admin() to authenticated;

drop policy if exists "Public can read TEND maintenance state" on public.tend_service_status;
create policy "Public can read TEND maintenance state" on public.tend_service_status for select to anon,authenticated using (id=1);
drop policy if exists "TEND admins can update maintenance state" on public.tend_service_status;
create policy "TEND admins can update maintenance state" on public.tend_service_status for all to authenticated using (public.tend_is_admin()) with check (public.tend_is_admin());

drop policy if exists "TEND admins can read system logs" on public.tend_system_logs;
create policy "TEND admins can read system logs" on public.tend_system_logs for select to authenticated using (public.tend_is_admin());
drop policy if exists "TEND admins can insert system logs" on public.tend_system_logs;
create policy "TEND admins can insert system logs" on public.tend_system_logs for insert to authenticated with check (public.tend_is_admin());
grant select on public.tend_service_status to anon,authenticated;
grant select,insert,update on public.tend_service_status to authenticated;
grant select,insert on public.tend_system_logs to authenticated;
