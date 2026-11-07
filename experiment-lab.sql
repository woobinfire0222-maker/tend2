create table if not exists public.tend_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text,
  display_name text not null default '사용자',
  updated_at timestamptz not null default now()
);

create table if not exists public.tend_experiment_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);

insert into public.tend_members (user_id, discord_id, display_name, updated_at)
select
  u.id,
  i.provider_id,
  coalesce(
    nullif(u.raw_user_meta_data->>'global_name',''),
    nullif(u.raw_user_meta_data->>'user_name',''),
    nullif(u.raw_user_meta_data->>'preferred_username',''),
    nullif(u.raw_user_meta_data->>'username',''),
    nullif(u.raw_user_meta_data->>'name',''),
    '사용자'
  ),
  now()
from auth.users u
left join lateral (
  select provider_id
  from auth.identities
  where user_id = u.id and provider = 'discord'
  order by created_at desc
  limit 1
) i on true
on conflict (user_id) do update set
  discord_id = excluded.discord_id,
  display_name = excluded.display_name,
  updated_at = now();

create or replace function public.tend_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.identities i
    where i.user_id = auth.uid()
      and i.provider = 'discord'
      and i.provider_id = '1318120987480424498'
  );
$$;

revoke all on function public.tend_is_admin() from public;
grant execute on function public.tend_is_admin() to authenticated;

alter table public.tend_members enable row level security;
alter table public.tend_experiment_members enable row level security;

drop policy if exists "tend members read self or admin" on public.tend_members;
create policy "tend members read self or admin"
on public.tend_members for select to authenticated
using (auth.uid() = user_id or public.tend_is_admin());

drop policy if exists "tend members insert self" on public.tend_members;
create policy "tend members insert self"
on public.tend_members for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "tend members update self" on public.tend_members;
create policy "tend members update self"
on public.tend_members for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tend experiment read self or admin" on public.tend_experiment_members;
create policy "tend experiment read self or admin"
on public.tend_experiment_members for select to authenticated
using (auth.uid() = user_id or public.tend_is_admin());

drop policy if exists "tend experiment insert admin" on public.tend_experiment_members;
create policy "tend experiment insert admin"
on public.tend_experiment_members for insert to authenticated
with check (public.tend_is_admin());

drop policy if exists "tend experiment delete admin" on public.tend_experiment_members;
create policy "tend experiment delete admin"
on public.tend_experiment_members for delete to authenticated
using (public.tend_is_admin());

grant select, insert, update on public.tend_members to authenticated;
grant select, insert, delete on public.tend_experiment_members to authenticated;
