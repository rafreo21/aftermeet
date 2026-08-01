begin;

alter table public.encounter_guest_follow_ups
  add column if not exists channel text not null default 'other'
    check (channel in ('email', 'linkedin', 'call', 'meeting', 'send', 'whatsapp', 'instagram', 'x', 'tiktok', 'other')),
  add column if not exists due_at date;

create or replace function public.get_shared_encounter(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_encounter_id uuid;
  v_latest_follow_up jsonb;
  v_follow_up_count integer;
  v_participants jsonb;
begin
  select e.id into v_encounter_id
  from public.encounters e
  where e.share_token = p_share_token and e.status = 'shared'
  limit 1;

  if v_encounter_id is null then return null; end if;

  select jsonb_build_object(
    'committedAt', gfu.committed_at,
    'note', gfu.note,
    'channel', gfu.channel,
    'dueAt', gfu.due_at
  ) into v_latest_follow_up
  from public.encounter_guest_follow_ups gfu
  where gfu.encounter_id = v_encounter_id
  order by gfu.committed_at desc
  limit 1;

  select count(*) into v_follow_up_count
  from public.encounter_guest_follow_ups
  where encounter_id = v_encounter_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'displayName', p.display_name) order by p.sort_order), '[]'::jsonb)
  into v_participants
  from public.encounter_participants p
  where p.encounter_id = v_encounter_id;

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
    'guestFollowUp', v_latest_follow_up,
    'guestFollowUpCount', v_follow_up_count,
    'participants', v_participants,
    'recording', case
      when e.recording_metadata is null then null
      when coalesce(e.recording_metadata ->> 'storagePath', '') = '' then null
      when coalesce(e.recording_metadata ->> 'cloudExpiresAt', '') <> ''
        and (e.recording_metadata ->> 'cloudExpiresAt')::timestamptz <= now() then null
      else jsonb_build_object(
        'durationSeconds', coalesce((e.recording_metadata ->> 'durationSeconds')::integer, 0),
        'mimeType', coalesce(e.recording_metadata ->> 'mimeType', 'audio/mp4'),
        'sharedAudioUrl', coalesce(
          e.recording_metadata ->> 'sharedAudioUrl',
          '/api/encounters/share/' || e.share_token || '/recording'
        ),
        'cloudExpiresAt', e.recording_metadata ->> 'cloudExpiresAt',
        'hasSharedAudio', true
      )
    end
  ) into result
  from public.encounters e
  where e.id = v_encounter_id;

  return result;
end;
$$;

grant execute on function public.get_shared_encounter(text) to anon, authenticated;

commit;
