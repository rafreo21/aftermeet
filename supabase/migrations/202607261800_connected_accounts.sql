begin;

create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text not null default '',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);

create index connected_accounts_workspace_user_idx
  on public.connected_accounts (workspace_id, user_id);

alter table public.connected_accounts enable row level security;
grant select, insert, update, delete on public.connected_accounts to authenticated;

create policy "connected_accounts_member_all" on public.connected_accounts for all to authenticated
  using (exists (
    select 1
    from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = connected_accounts.workspace_id
      and membership.user_id = connected_accounts.user_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = connected_accounts.workspace_id
      and membership.user_id = connected_accounts.user_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

commit;
