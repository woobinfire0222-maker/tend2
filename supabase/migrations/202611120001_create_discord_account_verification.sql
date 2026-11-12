
create table if not exists public.discord_verification_settings (
  server_id text primary key check (server_id ~ '^[0-9]{5,30}$'),
  enabled boolean not null default true,
  role_id text,
  nickname_template text not null default '{global_name}',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint discord_verification_role_id_check check (role_id is null or role_id ~ '^[0-9]{5,30}$'),
  constraint discord_verification_nickname_length check (char_length(nickname_template) between 1 and 32)
);

create table if not exists public.discord_verification_requests (
  id uuid primary key default gen_random_uuid(),
  server_id text not null check (server_id ~ '^[0-9]{5,30}$'),
  discord_user_id text not null check (discord_user_id ~ '^[0-9]{5,30}$'),
  discord_username text not null default '',
  discord_global_name text,
  discord_avatar text,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'issued' check (status in ('issued','submitted','approved','rejected','expired','failed')),
  expires_at timestamptz not null,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  apply_job_id uuid,
  applied_at timestamptz,
  apply_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_verification_requests_server_status_idx
  on public.discord_verification_requests (server_id, status, requested_at desc);
create index if not exists discord_verification_requests_user_idx
  on public.discord_verification_requests (server_id, discord_user_id, created_at desc);
create index if not exists discord_verification_requests_expiry_idx
  on public.discord_verification_requests (expires_at) where status in ('issued','submitted');

alter table public.discord_verification_settings enable row level security;
alter table public.discord_verification_requests enable row level security;
revoke all on public.discord_verification_settings from anon, authenticated;
revoke all on public.discord_verification_requests from anon, authenticated;
grant all on public.discord_verification_settings to service_role;
grant all on public.discord_verification_requests to service_role;
