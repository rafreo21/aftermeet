-- PL/pgSQL treats RETURNS TABLE column names as variables, which makes unqualified
-- workspace_id references in INSERT ... (workspace_id, ...) ambiguous.
begin;

create or replace function public.provision_personal_workspace()
returns table (user_id uuid, workspace_id uuid, onboarding_status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_auth_user_id uuid := auth.uid();
  v_user_id uuid;
  v_workspace_id uuid;
  v_email text;
  v_user_created boolean := false;
  v_workspace_created boolean := false;
begin
  if v_auth_user_id is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_auth_user_id::text, 0));
  select coalesce(auth.jwt() ->> 'email', '') into v_email;

  insert into public.users(auth_user_id, primary_email)
  values (v_auth_user_id, v_email)
  on conflict (auth_user_id) do update set
    primary_email = excluded.primary_email,
    updated_at = now()
  returning id, (xmax = 0) into v_user_id, v_user_created;

  insert into public.workspaces(name, owner_user_id)
  values ('My workspace', v_user_id)
  on conflict (owner_user_id) do update set updated_at = public.workspaces.updated_at
  returning id, (xmax = 0) into v_workspace_id, v_workspace_created;

  insert into public.workspace_memberships(workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  if v_user_created then
    insert into public.domain_events(event_name, actor_type, actor_id, workspace_id, object_type, object_id, correlation_id)
    values ('UserSignedUp', 'User', v_user_id, v_workspace_id, 'User', v_user_id, v_user_id)
    on conflict do nothing;
  end if;
  if v_workspace_created then
    insert into public.domain_events(event_name, actor_type, actor_id, workspace_id, object_type, object_id, correlation_id)
    values ('PersonalWorkspaceProvisioned', 'System', v_user_id, v_workspace_id, 'Workspace', v_workspace_id, v_workspace_id)
    on conflict do nothing;
  end if;

  return query
    select v_user_id, v_workspace_id, u.onboarding_status
    from public.users u
    where u.id = v_user_id;
end;
$$;

create or replace function public.complete_user_onboarding(
  p_display_name text, p_time_zone text, p_locale text
)
returns table (user_id uuid, workspace_id uuid, onboarding_status text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid;
  v_workspace_id uuid;
  v_changed boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if length(trim(p_display_name)) < 2 or length(trim(p_display_name)) > 100 then raise exception 'invalid display name'; end if;

  update public.users
  set display_name = trim(p_display_name), time_zone = p_time_zone, locale = p_locale,
      onboarding_status = 'completed', updated_at = now()
  where auth_user_id = auth.uid()
  returning id, (onboarding_status = 'completed') into v_user_id, v_changed;
  if v_user_id is null then raise exception 'application user not provisioned'; end if;
  select w.id into v_workspace_id
  from public.workspaces w
  join public.workspace_memberships m on m.workspace_id = w.id
  where m.user_id = v_user_id and m.status = 'active';

  insert into public.domain_events(event_name, actor_type, actor_id, workspace_id, object_type, object_id, correlation_id)
  values ('UserOnboardingCompleted', 'User', v_user_id, v_workspace_id, 'User', v_user_id, v_user_id)
  on conflict do nothing;
  return query select v_user_id, v_workspace_id, 'completed'::text;
end;
$$;

commit;
