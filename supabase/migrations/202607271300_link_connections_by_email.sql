begin;

create or replace function public.link_people_connections_for_email()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_user_email text;
  v_linked integer := 0;
  v_exchange record;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select lower(trim(u.primary_email)), w.id
  into v_user_email, v_workspace_id
  from public.users u
  join public.workspace_memberships m on m.user_id = u.id and m.status = 'active'
  join public.workspaces w on w.id = m.workspace_id and w.status = 'active'
  where u.auth_user_id = auth.uid() and u.status = 'active'
  limit 1;

  if v_workspace_id is null or v_user_email is null or v_user_email = '' then
    return 0;
  end if;

  for v_exchange in
    select
      exchange.id,
      exchange.visitor_email,
      card.id as card_id,
      card.slug,
      card.full_name as card_owner_name,
      card.job_title,
      card.company
    from public.card_exchanges exchange
    join public.cards card on card.id = exchange.card_id
    where lower(trim(exchange.visitor_email)) = v_user_email
  loop
    insert into public.people_connections (
      workspace_id,
      card_id,
      exchange_id,
      person_name,
      person_role,
      person_company,
      person_email,
      card_slug,
      card_owner_name
    ) values (
      v_workspace_id,
      v_exchange.card_id,
      v_exchange.id,
      v_exchange.card_owner_name,
      coalesce(v_exchange.job_title, ''),
      coalesce(v_exchange.company, ''),
      coalesce(v_exchange.visitor_email, ''),
      v_exchange.slug,
      v_exchange.card_owner_name
    )
    on conflict (workspace_id, card_id) do update set
      exchange_id = excluded.exchange_id,
      person_role = excluded.person_role,
      person_company = excluded.person_company,
      person_email = excluded.person_email,
      connected_at = now();

    v_linked := v_linked + 1;
  end loop;

  return v_linked;
end;
$$;

revoke all on function public.link_people_connections_for_email() from public;
grant execute on function public.link_people_connections_for_email() to authenticated;

commit;
