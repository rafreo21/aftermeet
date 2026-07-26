begin;

alter table public.encounters
  add column if not exists campaign_id text;

create index if not exists encounters_workspace_campaign_idx on public.encounters (workspace_id, campaign_id);

commit;
