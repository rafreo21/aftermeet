begin;

create table public.encounters (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  person_name text not null default '',
  person_email text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  consent jsonb not null,
  transcript text not null default '',
  private_notes text not null default '',
  shared_summary text not null default '',
  actions jsonb not null default '[]'::jsonb,
  recording_metadata jsonb,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'shared', 'archived')),
  share_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index encounters_workspace_started_idx on public.encounters(workspace_id, started_at desc);
alter table public.encounters enable row level security;
grant select, insert, update, delete on public.encounters to authenticated;

create policy "encounters_member_all" on public.encounters for all to authenticated
  using (exists (
    select 1
    from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = encounters.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = encounters.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

commit;
