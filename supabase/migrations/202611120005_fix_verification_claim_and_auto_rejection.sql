
create or replace function public.claim_pending_verification(
  p_worker_id text,
  p_lease_minutes integer default 5
)
returns setof public.discord_verification_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_id uuid;
  claimed_row public.discord_verification_requests;
begin
  select v.id
    into target_id
  from public.discord_verification_requests v
  where (
    (v.status = 'pending' and v.expires_at > now())
    or (
      v.status = 'processing'
      and coalesce(v.claimed_at, v.updated_at)
          < now() - make_interval(mins => greatest(coalesce(p_lease_minutes, 5), 1))
    )
  )
  order by v.requested_at
  limit 1
  for update skip locked;

  if target_id is null then
    return;
  end if;

  update public.discord_verification_requests
  set status = 'processing',
      claimed_at = now(),
      claimed_by = left(coalesce(nullif(p_worker_id, ''), 'unknown-worker'), 120),
      updated_at = now()
  where id = target_id
  returning * into claimed_row;

  if found then
    return next claimed_row;
  end if;
  return;
end;
$$;

create or replace function public.complete_verification_claim(
  p_request_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_ok then
    update public.discord_verification_requests
    set status = 'approved',
        applied_at = now(),
        apply_error = null,
        updated_at = now()
    where id = p_request_id
      and status = 'processing'
      and claimed_at is not null;
  elsif coalesce(p_error, '') like 'retryable:%' then
    update public.discord_verification_requests
    set status = 'failed',
        apply_error = left(p_error, 400),
        updated_at = now()
    where id = p_request_id
      and status = 'processing'
      and claimed_at is not null;
  else
    update public.discord_verification_requests
    set status = 'rejected',
        rejection_reason = left(coalesce(p_error, '자동 계정 검사 기준을 통과하지 못했습니다.'), 400),
        reviewed_at = now(),
        reviewed_by = null,
        updated_at = now()
    where id = p_request_id
      and status = 'processing'
      and claimed_at is not null;
  end if;
end;
$$;

revoke execute on function public.claim_pending_verification(text, integer)
  from public, anon, authenticated;
revoke execute on function public.expire_stale_verification_requests()
  from public, anon, authenticated;
revoke execute on function public.complete_verification_claim(uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function public.claim_pending_verification(text, integer) to service_role;
grant execute on function public.expire_stale_verification_requests() to service_role;
grant execute on function public.complete_verification_claim(uuid, boolean, text) to service_role;
