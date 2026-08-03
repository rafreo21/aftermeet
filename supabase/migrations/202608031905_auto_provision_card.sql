begin;

-- Every new workspace gets a default draft card so users land with
-- something to edit and publish instead of an empty card library.
create or replace function public.provision_personal_workspace()
returns table (user_id uuid, workspace_id uuid, onboarding_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_user_id uuid;
  v_workspace_id uuid;
  v_email text;
  v_metadata_name text;
  v_card_name text;
  v_card_slug text;
  v_user_created boolean := false;
  v_workspace_created boolean := false;
begin
  if v_auth_user_id is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_auth_user_id::text, 0));
  select coalesce(auth.jwt() ->> 'email', '') into v_email;
  select nullif(trim(coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    ''
  )), '') into v_metadata_name;

  insert into public.users(auth_user_id, primary_email, display_name)
  values (v_auth_user_id, v_email, v_metadata_name)
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

  if v_workspace_created then
    v_card_name := coalesce(
      v_metadata_name,
      nullif(case when length(split_part(v_email, '@', 1)) >= 2 then split_part(v_email, '@', 1) else null end, ''),
      'My card'
    );
    v_card_slug := 'card-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into public.cards (workspace_id, slug, full_name, status)
    values (v_workspace_id, v_card_slug, v_card_name, 'draft');
  end if;

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

  return query select v_user_id, v_workspace_id, u.onboarding_status from public.users u where u.id = v_user_id;
end;
$$;

commit;
