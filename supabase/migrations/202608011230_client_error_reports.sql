begin;

create table if not exists public.client_error_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  surface text not null,
  route text not null default '',
  message text not null,
  stack text not null default '',
  component_stack text not null default '',
  app_version text not null default '',
  platform text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists client_error_reports_workspace_created_idx
  on public.client_error_reports (workspace_id, created_at desc);

alter table public.client_error_reports enable row level security;

comment on table public.client_error_reports is
  'Authenticated consumer client crash diagnostics. Raw recordings and transcripts are never stored here.';

commit;
