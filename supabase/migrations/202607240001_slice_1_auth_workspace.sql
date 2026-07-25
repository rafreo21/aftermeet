begin;

create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  primary_email text not null,
  display_name text,
  avatar_url text,
  locale text not null default 'en-GB',
  time_zone text not null default 'Europe/London',
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'personal' check (type = 'personal'),
  owner_user_id uuid not null unique references public.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role = 'owner'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create unique index one_active_personal_workspace_per_user
  on public.workspace_memberships(user_id) where status = 'active';

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_version integer not null default 1 check (event_version > 0),
  occurred_at timestamptz not null default now(),
  actor_type text not null,
  actor_id uuid,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  correlation_id uuid not null,
  causation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  unique (event_name, object_id, correlation_id)
);

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.domain_events enable row level security;

revoke all on public.users, public.workspaces, public.workspace_memberships, public.domain_events from anon, authenticated;
grant select on public.users, public.workspaces, public.workspace_memberships to authenticated;
grant update (display_name, avatar_url, locale, time_zone) on public.users to authenticated;

create policy "users_select_self" on public.users for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy "users_update_profile_self" on public.users for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy "workspaces_select_active_member" on public.workspaces for select to authenticated
  using (exists (
    select 1
    from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = workspaces.id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

create policy "memberships_select_self" on public.workspace_memberships for select to authenticated
  using (exists (
    select 1 from public.users app_user
    where app_user.id = workspace_memberships.user_id
      and app_user.auth_user_id = (select auth.uid())
  ));

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

  return query select v_user_id, v_workspace_id, u.onboarding_status from public.users u where u.id = v_user_id;
end;
$$;

create or replace function public.get_my_app_context()
returns table (
  user_id uuid, primary_email text, display_name text, avatar_url text,
  locale text, time_zone text, onboarding_status text, workspace_id uuid
)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.primary_email, u.display_name, u.avatar_url, u.locale, u.time_zone,
    u.onboarding_status, w.id
  from public.users u
  join public.workspace_memberships m on m.user_id = u.id and m.status = 'active'
  join public.workspaces w on w.id = m.workspace_id and w.status = 'active'
  where u.auth_user_id = auth.uid() and u.status = 'active'
  limit 1
$$;

create or replace function public.complete_user_onboarding(
  p_display_name text, p_time_zone text, p_locale text
)
returns table (user_id uuid, workspace_id uuid, onboarding_status text)
language plpgsql security definer set search_path = ''
as $$
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

revoke all on function public.provision_personal_workspace() from public, anon;
revoke all on function public.get_my_app_context() from public, anon;
revoke all on function public.complete_user_onboarding(text, text, text) from public, anon;
grant execute on function public.provision_personal_workspace() to authenticated;
grant execute on function public.get_my_app_context() to authenticated;
grant execute on function public.complete_user_onboarding(text, text, text) to authenticated;

commit;
