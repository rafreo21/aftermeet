begin;

create table public.encounter_participants (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  display_name text not null default '' check (length(display_name) <= 160),
  email text not null default '' check (length(email) <= 320),
  phone text not null default '',
  linkedin_url text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  source text not null default 'manual' check (source in ('manual', 'exchange', 'contact', 'guest_claim')),
  exchange_id uuid references public.card_exchanges(id) on delete set null,
  claimed_by_user_id uuid references public.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index encounter_participants_primary_uidx
  on public.encounter_participants (encounter_id) where is_primary;
create index encounter_participants_encounter_idx
  on public.encounter_participants (encounter_id, sort_order);
create index encounter_participants_workspace_idx
  on public.encounter_participants (workspace_id, updated_at desc);
create index encounter_participants_contact_idx
  on public.encounter_participants (contact_id);
create unique index encounter_participants_encounter_email_uidx
  on public.encounter_participants (encounter_id, lower(email)) where email <> '';

-- Enforce the existing mobile MAX_GATHER_PEOPLE = 10 cap server-side too.
create or replace function public.enforce_encounter_participant_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.encounter_participants where encounter_id = new.encounter_id) >= 10 then
    raise exception 'A meeting can have at most 10 participants.';
  end if;
  return new;
end;
$$;

create trigger encounter_participants_cap
  before insert on public.encounter_participants
  for each row execute function public.enforce_encounter_participant_cap();

alter table public.encounter_participants enable row level security;
grant select, insert, update, delete on public.encounter_participants to authenticated;

create policy "encounter_participants_member_all" on public.encounter_participants for all to authenticated
  using (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = encounter_participants.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = encounter_participants.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

create table public.encounter_guest_follow_ups (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  participant_id uuid references public.encounter_participants(id) on delete set null,
  guest_name text not null default '' check (length(guest_name) <= 160),
  guest_email text not null default '' check (length(guest_email) <= 320),
  note text not null default '' check (length(note) <= 280),
  committed_at timestamptz not null default now(),
  claimed_by_user_id uuid references public.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One commitment per (encounter, identified participant); anonymous
-- (participant_id null) commitments are not de-duplicated by this index,
-- so multiple anonymous guests can each submit independently.
create unique index encounter_guest_follow_ups_participant_uidx
  on public.encounter_guest_follow_ups (encounter_id, participant_id) where participant_id is not null;
create index encounter_guest_follow_ups_encounter_idx
  on public.encounter_guest_follow_ups (encounter_id);

alter table public.encounter_guest_follow_ups enable row level security;
grant select on public.encounter_guest_follow_ups to authenticated;

-- Read-only for workspace members; writes only via the SECURITY DEFINER
-- commit_guest_follow_up RPC (rewritten in a later migration), matching the
-- existing guest_follow_up column's access model (no anon/authenticated
-- table-level insert grant).
create policy "encounter_guest_follow_ups_member_read" on public.encounter_guest_follow_ups for select to authenticated
  using (exists (
    select 1 from public.encounters e
    join public.workspace_memberships membership on membership.workspace_id = e.workspace_id
    join public.users app_user on app_user.id = membership.user_id
    where e.id = encounter_guest_follow_ups.encounter_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

commit;
