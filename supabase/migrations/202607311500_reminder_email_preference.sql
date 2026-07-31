begin;

alter table public.users
  add column reminder_emails_enabled boolean not null default true,
  add column reminder_last_sent_at timestamptz;

create or replace function public.set_reminder_email_preference(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  update public.users
  set reminder_emails_enabled = p_enabled,
      updated_at = now()
  where auth_user_id = auth.uid();

  return p_enabled;
end;
$$;

revoke all on function public.set_reminder_email_preference(boolean) from public;
grant execute on function public.set_reminder_email_preference(boolean) to authenticated;

commit;
