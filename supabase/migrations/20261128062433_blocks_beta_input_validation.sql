
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
  if char_length(trim(coalesce(application_purpose,'')))=0 then raise exception 'application_purpose_required' using errcode='22023'; end if;
  select * into v_identity from auth.identities where user_id=auth.uid() and provider='discord' order by created_at desc limit 1;
  if not found then raise exception 'discord_login_required' using errcode='42501'; end if;
  v_discord_id:=coalesce(nullif(v_identity.provider_id,''),nullif(v_identity.identity_data->>'provider_id',''),nullif(v_identity.identity_data->>'user_id',''),nullif(v_identity.identity_data->>'id',''),nullif(v_identity.identity_data->>'sub',''));
  if coalesce(v_discord_id,'') !~ '^[0-9]{17,20}$' then raise exception 'discord_identity_invalid' using errcode='42501'; end if;
  v_username:=left(coalesce(nullif(v_identity.identity_data->>'global_name',''),nullif(v_identity.identity_data->>'preferred_username',''),nullif(v_identity.identity_data->>'username',''),'Discord 사용자'),100);
  if exists(select 1 from public.blocks_beta_testers t where t.user_id=auth.uid() and t.is_active=true) then return jsonb_build_object('status','approved','already_tester',true); end if;
  select * into v_existing from public.blocks_beta_applications where user_id=auth.uid() and status='pending' order by created_at desc limit 1;
  if found then return jsonb_build_object('status','pending','application_id',v_existing.id,'already_submitted',true); end if;
  insert into public.blocks_beta_applications(user_id,discord_id,discord_username,experience,purpose)
  values(auth.uid(),v_discord_id,v_username,left(coalesce(application_experience,''),1000),left(trim(application_purpose),2000))
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
  if decision='rejected' and char_length(trim(coalesce(note,'')))=0 then raise exception 'rejection_reason_required' using errcode='22023'; end if;
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
revoke all on function public.blocks_submit_beta_application(text,text) from public,anon;
revoke all on function public.blocks_review_beta_application(uuid,text,text) from public,anon;
grant execute on function public.blocks_submit_beta_application(text,text) to authenticated;
grant execute on function public.blocks_review_beta_application(uuid,text,text) to authenticated;
