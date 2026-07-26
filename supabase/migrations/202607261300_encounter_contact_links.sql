begin;

alter table public.encounters
  add column if not exists contact_id text,
  add column if not exists exchange_id uuid references public.card_exchanges(id) on delete set null;

create index if not exists encounters_contact_id_idx on public.encounters (workspace_id, contact_id);
create index if not exists encounters_exchange_id_idx on public.encounters (exchange_id);

create or replace function public.get_shared_encounter(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'personName', e.person_name,
    'personEmail', e.person_email,
    'startedAt', e.started_at,
    'endedAt', e.ended_at,
    'durationSeconds', e.duration_seconds,
    'consent', e.consent,
    'transcript', e.transcript,
    'privateNotes', e.private_notes,
    'sharedSummary', e.shared_summary,
    'actions', e.actions,
    'status', e.status,
    'shareToken', e.share_token,
    'contactId', e.contact_id,
    'exchangeId', e.exchange_id
  )
  into result
  from public.encounters e
  where e.share_token = p_share_token
    and e.status = 'shared'
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_shared_encounter(text) from public;
grant execute on function public.get_shared_encounter(text) to anon, authenticated;

commit;
