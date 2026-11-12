alter table public.discord_verification_requests
  drop constraint if exists discord_verification_requests_status_check;

alter table public.discord_verification_requests
  add constraint discord_verification_requests_status_check
  check (status = any (array[
    'issued'::text,
    'submitted'::text,
    'processing'::text,
    'approved'::text,
    'rejected'::text,
    'expired'::text,
    'failed'::text
  ]));
