-- Run against a disposable Supabase database after applying migrations.
-- These catalog assertions fail loudly if browser-write protections regress.
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name in ('workspace_memberships', 'domain_events')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then raise exception 'browser role can mutate protected system tables'; end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'users') < 2 then
    raise exception 'users RLS policies are incomplete';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'provision_personal_workspace' and p.prosecdef
  ) then raise exception 'provisioning function is not SECURITY DEFINER'; end if;
end $$;
