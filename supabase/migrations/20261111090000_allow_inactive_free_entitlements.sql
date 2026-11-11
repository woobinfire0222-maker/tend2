alter table public.free_entitlements drop constraint if exists free_entitlements_status_check;

alter table public.free_entitlements
  add constraint free_entitlements_status_check
  check (status = any (array['active'::text, 'suspended'::text, 'inactive'::text]));
