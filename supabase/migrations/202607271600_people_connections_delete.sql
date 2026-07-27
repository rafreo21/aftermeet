begin;

grant delete on public.people_connections to authenticated;

drop policy if exists "people_connections_member_delete" on public.people_connections;

create policy "people_connections_member_delete" on public.people_connections
  for delete to authenticated
  using (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = people_connections.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

commit;
