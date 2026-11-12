alter table public.discord_verification_requests
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text;

alter table public.discord_verification_requests
  drop constraint if exists discord_verification_requests_status_check;

alter table public.discord_verification_requests
  add constraint discord_verification_requests_status_check
  check (status = any (array[
    'issued'::text,
    'pending'::text,
    'submitted'::text,
    'processing'::text,
    'approved'::text,
    'rejected'::text,
    'expired'::text,
    'failed'::text
  ]));

create index if not exists idx_dvr_pending_requested
  on public.discord_verification_requests (requested_at)
  where status = 'pending';

create index if not exists idx_dvr_approved_unclaimed
  on public.discord_verification_requests (reviewed_at)
  where status = 'approved' and claimed_at is null;
