begin;

create or replace function public.get_my_reminder_preference()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select reminder_emails_enabled from public.users where auth_user_id = auth.uid();
$$;

revoke all on function public.get_my_reminder_preference() from public;
grant execute on function public.get_my_reminder_preference() to authenticated;

commit;
