
create table if not exists public.blocks_beta_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_id text not null check (discord_id ~ '^[0-9]{17,20}$'),
  discord_username text not null default 'Discord 사용자',
  experience text not null default '',
  purpose text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blocks_beta_applications_status_created_idx on public.blocks_beta_applications(status,created_at desc);
create unique index if not exists blocks_beta_applications_one_pending_per_user on public.blocks_beta_applications(user_id) where status='pending';

create table if not exists public.blocks_beta_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text not null unique check (discord_id ~ '^[0-9]{17,20}$'),
  is_active boolean not null default true,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.blocks_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  server_id text not null check (server_id ~ '^[0-9]{17,20}$'),
  name text not null default '새 프로젝트' check (char_length(name) between 1 and 60),
  project_data jsonb not null default '{"version":1,"blocks":[]}'::jsonb,
  is_enabled boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blocks_projects_data_size check (pg_column_size(project_data)<=200000),
  constraint blocks_projects_block_limit check (
    jsonb_typeof(project_data)='object'
    and jsonb_typeof(project_data->'blocks')='array'
    and jsonb_array_length(project_data->'blocks')<=50
  )
);
create index if not exists blocks_projects_server_enabled_idx on public.blocks_projects(server_id,is_enabled);
create index if not exists blocks_projects_owner_updated_idx on public.blocks_projects(owner_id,updated_at desc);

create table if not exists public.blocks_execution_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.blocks_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  server_id text not null,
  event_type text not null default 'unknown',
  status text not null default 'success' check (status in ('success','failed','skipped')),
  message text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists blocks_execution_logs_owner_created_idx on public.blocks_execution_logs(owner_id,created_at desc);

alter table public.blocks_beta_applications enable row level security;
alter table public.blocks_beta_testers enable row level security;
alter table public.blocks_projects enable row level security;
alter table public.blocks_execution_logs enable row level security;

grant select on public.blocks_beta_applications to authenticated;
grant select on public.blocks_beta_testers to authenticated;
grant select,insert,update,delete on public.blocks_projects to authenticated;
grant select on public.blocks_execution_logs to authenticated;
grant all on public.blocks_beta_applications,public.blocks_beta_testers,public.blocks_projects,public.blocks_execution_logs to service_role;

create or replace function public.blocks_is_beta_tester()
returns boolean language sql stable security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null and exists(select 1 from public.blocks_beta_testers t where t.user_id=auth.uid() and t.is_active=true);
$$;

create or replace function public.blocks_has_server_access(target_server_id text)
returns boolean language sql stable security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null and target_server_id ~ '^[0-9]{17,20}$'
  and exists(select 1 from public.discord_user_guilds g where g.user_id=auth.uid() and g.guild_id=target_server_id and g.can_manage=true);
$$;

create or replace function public.blocks_list_servers()
returns table(server_id text,server_name text,is_owner boolean,bot_connected boolean,service_active boolean)
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
begin
  if not public.blocks_is_beta_tester() then raise exception 'beta_access_required' using errcode='42501'; end if;
  return query select g.guild_id,g.guild_name,g.is_owner,coalesce(m.bot_connected,false),coalesce(m.is_active,false)
  from public.discord_user_guilds g left join public.managed_servers m on m.server_id=g.guild_id
  where g.user_id=auth.uid() and g.can_manage=true order by g.guild_name asc;
end;
$$;

create or replace function public.blocks_submit_beta_application(application_experience text default '',application_purpose text default '')
returns jsonb language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_identity auth.identities%rowtype;
  v_discord_id text;
  v_username text;
  v_existing public.blocks_beta_applications%rowtype;
  v_new public.blocks_beta_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_identity from auth.identities where user_id=auth.uid() and provider='discord' order by created_at desc limit 1;
  if not found then raise exception 'discord_login_required' using errcode='42501'; end if;
  v_discord_id:=coalesce(nullif(v_identity.provider_id,''),nullif(v_identity.identity_data->>'provider_id',''),nullif(v_identity.identity_data->>'user_id',''),nullif(v_identity.identity_data->>'id',''),nullif(v_identity.identity_data->>'sub',''));
  if v_discord_id !~ '^[0-9]{17,20}$' then raise exception 'discord_identity_invalid' using errcode='42501'; end if;
  v_username:=left(coalesce(nullif(v_identity.identity_data->>'global_name',''),nullif(v_identity.identity_data->>'preferred_username',''),nullif(v_identity.identity_data->>'username',''),'Discord 사용자'),100);
  if exists(select 1 from public.blocks_beta_testers t where t.user_id=auth.uid() and t.is_active=true) then return jsonb_build_object('status','approved','already_tester',true); end if;
  select * into v_existing from public.blocks_beta_applications where user_id=auth.uid() and status='pending' order by created_at desc limit 1;
  if found then return jsonb_build_object('status','pending','application_id',v_existing.id,'already_submitted',true); end if;
  insert into public.blocks_beta_applications(user_id,discord_id,discord_username,experience,purpose)
  values(auth.uid(),v_discord_id,v_username,left(coalesce(application_experience,''),1000),left(coalesce(application_purpose,''),2000))
  returning * into v_new;
  return jsonb_build_object('status','pending','application_id',v_new.id,'already_submitted',false);
end;
$$;

create or replace function public.blocks_review_beta_application(target_application_id uuid,decision text,note text default '')
returns jsonb language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_app public.blocks_beta_applications%rowtype;
begin
  if not public.tend_is_super_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode='22023'; end if;
  select * into v_app from public.blocks_beta_applications where id=target_application_id for update;
  if not found then raise exception 'application_not_found' using errcode='P0002'; end if;
  if v_app.status<>'pending' then raise exception 'application_already_reviewed' using errcode='22023'; end if;
  update public.blocks_beta_applications set status=decision,admin_note=left(coalesce(note,''),1000),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=target_application_id;
  if decision='approved' then
    insert into public.blocks_beta_testers(user_id,discord_id,is_active,granted_by,granted_at,revoked_at)
    values(v_app.user_id,v_app.discord_id,true,auth.uid(),now(),null)
    on conflict(user_id) do update set discord_id=excluded.discord_id,is_active=true,granted_by=auth.uid(),granted_at=now(),revoked_at=null;
  end if;
  return jsonb_build_object('ok',true,'status',decision,'user_id',v_app.user_id);
end;
$$;

create or replace function public.blocks_revoke_beta_access(target_user_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp
as $$
begin
  if not public.tend_is_super_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  update public.blocks_beta_testers set is_active=false,revoked_at=now() where user_id=target_user_id and is_active=true;
  if not found then return jsonb_build_object('ok',false,'reason','not_active'); end if;
  update public.blocks_projects set is_enabled=false,updated_at=now() where owner_id=target_user_id;
  return jsonb_build_object('ok',true);
end;
$$;

drop policy if exists blocks_beta_applications_select_own_or_admin on public.blocks_beta_applications;
create policy blocks_beta_applications_select_own_or_admin on public.blocks_beta_applications for select to authenticated
using(user_id=auth.uid() or public.tend_is_super_admin());
drop policy if exists blocks_beta_testers_select_own_or_admin on public.blocks_beta_testers;
create policy blocks_beta_testers_select_own_or_admin on public.blocks_beta_testers for select to authenticated
using(user_id=auth.uid() or public.tend_is_super_admin());
drop policy if exists blocks_projects_select_own on public.blocks_projects;
create policy blocks_projects_select_own on public.blocks_projects for select to authenticated
using(owner_id=auth.uid() and public.blocks_is_beta_tester() and public.blocks_has_server_access(server_id));
drop policy if exists blocks_projects_insert_own on public.blocks_projects;
create policy blocks_projects_insert_own on public.blocks_projects for insert to authenticated
with check(owner_id=auth.uid() and public.blocks_is_beta_tester() and public.blocks_has_server_access(server_id));
drop policy if exists blocks_projects_update_own on public.blocks_projects;
create policy blocks_projects_update_own on public.blocks_projects for update to authenticated
using(owner_id=auth.uid() and public.blocks_is_beta_tester() and public.blocks_has_server_access(server_id))
with check(owner_id=auth.uid() and public.blocks_is_beta_tester() and public.blocks_has_server_access(server_id));
drop policy if exists blocks_projects_delete_own on public.blocks_projects;
create policy blocks_projects_delete_own on public.blocks_projects for delete to authenticated
using(owner_id=auth.uid() and public.blocks_is_beta_tester());
drop policy if exists blocks_execution_logs_select_own on public.blocks_execution_logs;
create policy blocks_execution_logs_select_own on public.blocks_execution_logs for select to authenticated
using(owner_id=auth.uid() and public.blocks_is_beta_tester());

revoke all on function public.blocks_is_beta_tester() from public,anon;
revoke all on function public.blocks_has_server_access(text) from public,anon;
revoke all on function public.blocks_list_servers() from public,anon;
revoke all on function public.blocks_submit_beta_application(text,text) from public,anon;
revoke all on function public.blocks_review_beta_application(uuid,text,text) from public,anon;
revoke all on function public.blocks_revoke_beta_access(uuid) from public,anon;
grant execute on function public.blocks_is_beta_tester() to authenticated;
grant execute on function public.blocks_has_server_access(text) to authenticated;
grant execute on function public.blocks_list_servers() to authenticated;
grant execute on function public.blocks_submit_beta_application(text,text) to authenticated;
grant execute on function public.blocks_review_beta_application(uuid,text,text) to authenticated;
grant execute on function public.blocks_revoke_beta_access(uuid) to authenticated;
