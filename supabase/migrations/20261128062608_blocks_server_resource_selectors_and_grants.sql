
revoke all on table public.blocks_beta_applications,public.blocks_beta_testers,public.blocks_projects,public.blocks_execution_logs from anon,authenticated,service_role;
grant select on table public.blocks_beta_applications to authenticated;
grant select on table public.blocks_beta_testers to authenticated;
grant select,insert,update,delete on table public.blocks_projects to authenticated;
grant select on table public.blocks_execution_logs to authenticated;
grant all on table public.blocks_beta_applications,public.blocks_beta_testers,public.blocks_projects,public.blocks_execution_logs to service_role;

create or replace function private.blocks_list_server_resources(target_server_id text)
returns jsonb language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare v_result jsonb;
begin
  if not private.blocks_is_beta_tester() then raise exception 'beta_access_required' using errcode='42501'; end if;
  if not private.blocks_has_server_access(target_server_id) then raise exception 'server_access_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'channels',coalesce((select jsonb_agg(jsonb_build_object('id',c.channel_id,'name',c.channel_name,'type',c.channel_type) order by c.channel_name)
      from public.discord_server_channels c where c.server_id=target_server_id and c.is_active=true and c.can_send=true),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.role_id,'name',r.role_name,'mentionable',r.mentionable) order by r.role_name)
      from public.discord_server_roles r where r.server_id=target_server_id and r.is_everyone=false),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
create or replace function public.blocks_list_server_resources(target_server_id text)
returns jsonb language sql stable security invoker set search_path=public,private,pg_temp
as $$ select private.blocks_list_server_resources(target_server_id); $$;
revoke all on function private.blocks_list_server_resources(text) from public,anon;
grant execute on function private.blocks_list_server_resources(text) to authenticated;
revoke all on function public.blocks_list_server_resources(text) from public,anon;
grant execute on function public.blocks_list_server_resources(text) to authenticated;
