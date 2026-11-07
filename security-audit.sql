-- TEND read-only security audit
-- Run in Supabase Dashboard > SQL Editor using the postgres role.
-- This script only reads catalog metadata. It does not alter data, policies, or permissions.

-- 1) Public tables: RLS state and client-role privileges.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
  has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')
order by c.relname;

-- 2) Every RLS policy in public, including USING and WITH CHECK expressions.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Tables that have client privileges but RLS is disabled.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
  has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and not c.relrowsecurity
  and (
    has_table_privilege('anon', c.oid, 'SELECT')
    or has_table_privilege('anon', c.oid, 'INSERT')
    or has_table_privilege('anon', c.oid, 'UPDATE')
    or has_table_privilege('anon', c.oid, 'DELETE')
    or has_table_privilege('authenticated', c.oid, 'SELECT')
    or has_table_privilege('authenticated', c.oid, 'INSERT')
    or has_table_privilege('authenticated', c.oid, 'UPDATE')
    or has_table_privilege('authenticated', c.oid, 'DELETE')
  )
order by c.relname;

-- 4) Explicit table grants to PUBLIC, anon, and authenticated.
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('PUBLIC','anon','authenticated')
order by table_name, grantee, privilege_type;

-- 5) SECURITY DEFINER functions and client EXECUTE privileges.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','storage')
order by n.nspname, p.proname;

-- 6) Views in public schema. Check whether security_invoker is enabled.
select
  schemaname,
  viewname,
  coalesce((select option_value
            from pg_options_to_table(c.reloptions)
            where option_name = 'security_invoker'), 'false') as security_invoker,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_views v
join pg_namespace n on n.nspname = v.schemaname
join pg_class c on c.relnamespace = n.oid and c.relname = v.viewname
where v.schemaname = 'public'
order by v.viewname;

-- 7) Storage object policies and bucket visibility.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;

-- 8) Default privileges that may silently grant access to newly created objects.
select
  coalesce(n.nspname, '(all schemas)') as schema_name,
  pg_get_userbyid(d.defaclrole) as object_owner,
  d.defaclobjtype as object_type,
  x.grantee::regrole::text as grantee,
  x.privilege_type,
  x.is_grantable
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) x
where x.grantee = 0
   or x.grantee in (select oid from pg_roles where rolname in ('anon','authenticated','service_role'))
order by schema_name, object_owner, object_type, grantee, privilege_type;

-- 9) Schema-level access.
select
  n.nspname as schema_name,
  has_schema_privilege('anon', n.oid, 'USAGE') as anon_usage,
  has_schema_privilege('anon', n.oid, 'CREATE') as anon_create,
  has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_usage,
  has_schema_privilege('authenticated', n.oid, 'CREATE') as authenticated_create
from pg_namespace n
where n.nspname in ('public','storage')
order by n.nspname;
