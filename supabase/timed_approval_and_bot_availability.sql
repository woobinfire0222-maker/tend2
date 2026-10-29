-- TEND timed approval + bot availability migration
-- Run once in Supabase SQL Editor after backing up the project.

alter table public.purchase_requests
  add column if not exists approved_at timestamptz,
  add column if not exists expires_at timestamptz;

alter table public.managed_servers
  add column if not exists management_available boolean not null default false,
  add column if not exists expires_at timestamptz,
  add column if not exists bot_invite_url text;

-- An approval starts the purchased duration exactly once. Re-saving an already
-- approved request does not extend the subscription.
create or replace function public.tend_apply_purchase_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  duration_days integer;
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved' or new.expires_at is null) then
    duration_days := case
      when new.plan ~* '^\s*1\s*일' then 1
      when new.plan ~* '^\s*7\s*일' then 7
      when new.plan ~* '^\s*30\s*일' then 30
      else null
    end;
    if duration_days is null then
      raise exception 'Unsupported TEND plan: %', new.plan;
    end if;
    new.approved_at := now();
    new.expires_at := now() + make_interval(days => duration_days);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tend_purchase_approval_timer on public.purchase_requests;
create trigger tend_purchase_approval_timer
before insert or update of status, plan on public.purchase_requests
for each row execute function public.tend_apply_purchase_approval();

-- Keep the server registry in sync when an application is approved.
create or replace function public.tend_sync_approved_server()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and new.server_id is not null and btrim(new.server_id) <> '' then
    insert into public.managed_servers
      (server_id, server_name, owner_id, is_active, management_available, expires_at, updated_at)
    values
      (new.server_id, coalesce(nullif(new.server_name,''),'Discord 서버'), new.user_id::text, false, false, new.expires_at, now())
    on conflict (server_id) do update set
      server_name = coalesce(nullif(excluded.server_name,''), public.managed_servers.server_name),
      expires_at = excluded.expires_at,
      management_available = public.managed_servers.bot_connected
        and coalesce(excluded.expires_at, now()) > now(),
      updated_at = now();
  elsif new.server_id is not null and new.status = 'rejected' then
    update public.managed_servers
      set management_available = false, is_active = false, updated_at = now()
      where server_id = new.server_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tend_sync_approved_server_trigger on public.purchase_requests;
create trigger tend_sync_approved_server_trigger
after insert or update of status, server_id, server_name on public.purchase_requests
for each row execute function public.tend_sync_approved_server();

-- A read-only view gives a reliable current status even if a periodic bot job
-- has not yet refreshed the cached management_available field.
create or replace view public.server_management_status as
select
  ms.server_id,
  ms.server_name,
  ms.bot_connected,
  ms.is_active,
  ms.last_seen_at,
  ms.expires_at,
  (ms.bot_connected
   and ms.last_seen_at > now() - interval '2 minutes'
   and ms.expires_at > now()
   and exists (
     select 1 from public.purchase_requests pr
     where pr.server_id = ms.server_id
       and pr.status = 'approved'
       and pr.expires_at > now()
   )) as management_available
from public.managed_servers ms
where exists (
  select 1 from public.purchase_requests own_pr
  where own_pr.server_id = ms.server_id
    and own_pr.user_id = auth.uid()
    and own_pr.status = 'approved'
);

grant select on public.server_management_status to authenticated;
