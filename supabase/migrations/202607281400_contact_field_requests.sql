create table if not exists public.contact_field_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  target_email text not null,
  target_exchange_id uuid references public.card_exchanges(id) on delete set null,
  field_type text not null check (field_type in ('phone', 'email', 'linkedin', 'whatsapp')),
  channel text not null,
  follow_up_title text not null default '',
  encounter_id uuid references public.encounters(id) on delete set null,
  action_id text,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists contact_field_requests_target_email_idx
  on public.contact_field_requests (target_email, status, created_at desc);

create index if not exists contact_field_requests_workspace_idx
  on public.contact_field_requests (workspace_id, created_at desc);

alter table public.contact_field_requests enable row level security;

grant select, insert on public.contact_field_requests to authenticated;

-- Readable by whoever the request targets (they need to see "X wants your
-- phone number") and by the requester (to see the status of what they sent).
create policy "contact_field_requests_select_target_or_requester" on public.contact_field_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.users app_user
      where app_user.auth_user_id = (select auth.uid())
        and (
          lower(app_user.primary_email) = contact_field_requests.target_email
          or app_user.id = contact_field_requests.requester_user_id
        )
    )
  );

-- Insertable only by an active member of the workspace they're requesting on
-- behalf of, and only as themselves (matches how /api/contact-requests writes).
create policy "contact_field_requests_insert_requester" on public.contact_field_requests
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.users app_user
      join public.workspace_memberships membership on membership.user_id = app_user.id
      where app_user.auth_user_id = (select auth.uid())
        and app_user.id = contact_field_requests.requester_user_id
        and membership.workspace_id = contact_field_requests.workspace_id
        and membership.status = 'active'
    )
  );
