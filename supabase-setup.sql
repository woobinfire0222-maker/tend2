-- TEND Supabase setup
-- Run this in Supabase Dashboard > SQL Editor as the project owner.
-- Admin authorization uses app_metadata.role, which users cannot edit themselves.

create extension if not exists pgcrypto;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('1일', '7일', '30일')),
  server_name text not null check (char_length(server_name) between 1 and 100),
  server_id text null check (server_id is null or server_id ~ '^[0-9]{5,30}$'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_requests_user_created_idx
  on public.purchase_requests (user_id, created_at desc);

alter table public.purchase_requests enable row level security;

drop policy if exists "Users can read their own requests" on public.purchase_requests;
create policy "Users can read their own requests"
  on public.purchase_requests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own requests" on public.purchase_requests;
create policy "Users can create their own requests"
  on public.purchase_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Admins can read all requests" on public.purchase_requests;
create policy "Admins can read all requests"
  on public.purchase_requests for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update requests" on public.purchase_requests;
create policy "Admins can update requests"
  on public.purchase_requests for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.set_purchase_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists purchase_requests_updated_at on public.purchase_requests;
create trigger purchase_requests_updated_at
before update on public.purchase_requests
for each row execute function public.set_purchase_requests_updated_at();

grant usage on schema public to authenticated;
grant select, insert on public.purchase_requests to authenticated;
grant update (status) on public.purchase_requests to authenticated;

-- After creating this table, grant admin access to the intended administrator
-- from a trusted server/Admin API only; never from browser-side code:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where id = '<trusted-admin-auth-user-uuid>';
