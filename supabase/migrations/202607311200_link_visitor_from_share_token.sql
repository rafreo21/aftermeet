begin;

create or replace function public.link_people_connection_from_share_token(p_share_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_encounter record;
  v_connection_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select w.id into v_workspace_id
  from public.users u
  join public.workspace_memberships m on m.user_id = u.id and m.status = 'active'
  join public.workspaces w on w.id = m.workspace_id and w.status = 'active'
  where u.auth_user_id = auth.uid() and u.status = 'active'
  limit 1;

  if v_workspace_id is null then raise exception 'workspace not found'; end if;

  select
    encounter.id,
    card.id as card_id,
    card.slug,
    card.full_name,
    card.job_title,
    card.company
  into v_encounter
  from public.encounters encounter
  join public.cards card on card.workspace_id = encounter.workspace_id and card.status = 'published'
  where encounter.share_token = trim(p_share_token)
    and encounter.status = 'shared'
  limit 1;

  if v_encounter.id is null then raise exception 'shared encounter not found'; end if;

  insert into public.people_connections (
    workspace_id,
    card_id,
    person_name,
    person_role,
    person_company,
    card_slug,
    card_owner_name
  ) values (
    v_workspace_id,
    v_encounter.card_id,
    v_encounter.full_name,
    coalesce(v_encounter.job_title, ''),
    coalesce(v_encounter.company, ''),
    v_encounter.slug,
    v_encounter.full_name
  )
  on conflict (workspace_id, card_id) do update set
    connected_at = now()
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;

revoke all on function public.link_people_connection_from_share_token(text) from public;
grant execute on function public.link_people_connection_from_share_token(text) to authenticated;

commit;
