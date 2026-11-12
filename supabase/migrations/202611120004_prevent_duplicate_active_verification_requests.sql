create unique index if not exists uq_dvr_one_active_request_per_user_server
  on public.discord_verification_requests (server_id, discord_user_id)
  where status in ('pending', 'processing');
