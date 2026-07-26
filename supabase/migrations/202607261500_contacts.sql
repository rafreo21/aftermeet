begin;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  linkedin_url text not null default '',
  company text not null default '',
  role text not null default '',
  context text not null default '',
  source text check (source is null or source in ('csv', 'vcard', 'manual', 'exchange', 'badge', 'linkedin', 'scan')),
  exchange_id uuid references public.card_exchanges(id) on delete set null,
  campaign_id text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_workspace_updated_idx on public.contacts (workspace_id, updated_at desc);
create index contacts_workspace_legacy_idx on public.contacts (workspace_id, legacy_id);
create unique index contacts_workspace_exchange_uidx on public.contacts (workspace_id, exchange_id) where exchange_id is not null;
create unique index contacts_workspace_legacy_uidx on public.contacts (workspace_id, legacy_id) where legacy_id is not null;

alter table public.contacts enable row level security;
grant select, insert, update, delete on public.contacts to authenticated;

create policy "contacts_member_all" on public.contacts for all to authenticated
  using (exists (
    select 1
    from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = contacts.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = contacts.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

commit;
