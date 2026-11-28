
create or replace function private.blocks_list_servers()
returns table(server_id text,server_name text,is_owner boolean,bot_connected boolean,service_active boolean)
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
begin
  if not private.blocks_is_beta_tester() then raise exception 'beta_access_required' using errcode='42501'; end if;
  return query
    select g.guild_id,g.guild_name,g.is_owner,
      (b.guild_id is not null or coalesce(m.bot_connected,false)),
      (coalesce(m.is_active,false) or coalesce(b.service_active,false))
    from public.discord_user_guilds g
    left join public.guilds b on b.guild_id::text=g.guild_id
    left join public.managed_servers m on m.server_id=g.guild_id
    where g.user_id=auth.uid() and g.can_manage=true
    order by g.guild_name asc;
end;
$$;
