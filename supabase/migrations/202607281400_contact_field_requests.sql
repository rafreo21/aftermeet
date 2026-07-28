create table if not exists public.contact_field_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
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

create policy "workspace members manage contact field requests"
  on public.contact_field_requests
  for all
  using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );
