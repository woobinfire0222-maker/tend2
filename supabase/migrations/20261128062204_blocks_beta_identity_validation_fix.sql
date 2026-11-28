
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
  if coalesce(v_discord_id,'') !~ '^[0-9]{17,20}$' then raise exception 'discord_identity_invalid' using errcode='42501'; end if;
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
revoke all on function public.blocks_submit_beta_application(text,text) from public,anon;
grant execute on function public.blocks_submit_beta_application(text,text) to authenticated;
