begin;

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
    'sharedSummary', e.shared_summary,
    'actions', e.actions,
    'status', e.status,
    'shareToken', e.share_token,
    'contactId', e.contact_id,
    'exchangeId', e.exchange_id,
    'recording', case
      when e.recording_metadata is null then null
      when coalesce(e.recording_metadata ->> 'storagePath', '') = '' then null
      else jsonb_build_object(
        'durationSeconds', coalesce((e.recording_metadata ->> 'durationSeconds')::integer, 0),
        'mimeType', coalesce(e.recording_metadata ->> 'mimeType', 'audio/mp4'),
        'sharedAudioUrl', coalesce(
          e.recording_metadata ->> 'sharedAudioUrl',
          '/api/encounters/share/' || e.share_token || '/recording'
        ),
        'hasSharedAudio', true
      )
    end
  )
  into result
  from public.encounters e
  where e.share_token = p_share_token
    and e.status = 'shared'
  limit 1;

  return result;
end;
$$;

commit;
