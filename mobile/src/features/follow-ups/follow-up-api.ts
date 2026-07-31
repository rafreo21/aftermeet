import type { EncounterAction, EncounterParticipant, EncounterPayload } from '@/features/encounters/encounter-api';
import { mobileFetch } from '@/lib/mobile-api';
import { sortFollowUps } from '@/lib/due-date';

export type FollowUpItem = {
  encounterId: string;
  actionId: string;
  groupId?: string;
  title: string;
  channel: EncounterAction['channel'];
  dueAt: string;
  status: EncounterAction['status'];
  personName: string;
  personEmail: string;
  participantId?: string;
  participants: EncounterParticipant[];
  contactId?: string;
  exchangeId?: string;
  encounterTitle: string;
  startedAt: string;
};

export async function fetchFollowUps(accessToken: string) {
  const response = await mobileFetch('/api/follow-ups', accessToken);
  const payload = await response.json() as { followUps?: Array<Record<string, unknown>>; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load follow-ups.');
  }
  return sortFollowUps((payload.followUps ?? []).map((row) => ({
    encounterId: String(row.encounterId ?? ''),
    actionId: String(row.actionId ?? ''),
    groupId: typeof row.groupId === 'string' ? row.groupId : undefined,
    title: String(row.title ?? ''),
    channel: row.channel as FollowUpItem['channel'],
    dueAt: String(row.dueAt ?? ''),
    status: row.status as FollowUpItem['status'],
    personName: String(row.personName ?? ''),
    personEmail: String(row.personEmail ?? ''),
    participantId: typeof row.participantId === 'string' ? row.participantId : undefined,
    participants: Array.isArray(row.participants) ? row.participants as EncounterParticipant[] : [],
    contactId: typeof row.contactId === 'string' ? row.contactId : undefined,
    exchangeId: typeof row.exchangeId === 'string' ? row.exchangeId : undefined,
    encounterTitle: String(row.encounterTitle ?? ''),
    startedAt: String(row.startedAt ?? ''),
  })));
}

export async function completeFollowUp(accessToken: string, encounterId: string, actionId: string) {
  const response = await mobileFetch(`/api/encounters/${encounterId}/actions/${actionId}`, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Could not complete this follow-up.');
  }
}

export async function fetchEncounterRecords(accessToken: string) {
  const response = await mobileFetch('/api/encounters', accessToken);
  const payload = await response.json() as { encounters?: Array<Record<string, unknown>>; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load encounters.');
  }
  return (payload.encounters ?? []).map((row) => mapEncounter(row));
}

export async function fetchEncountersForConnection(
  accessToken: string,
  input: { connectionId: string; sourceId: string; email?: string; exchangeId?: string },
) {
  const params = new URLSearchParams();
  if (input.connectionId) params.set('contactId', input.connectionId);
  if (input.sourceId) params.set('sourceId', input.sourceId);
  if (input.email?.trim()) params.set('email', input.email.trim());
  if (input.exchangeId?.trim()) params.set('exchangeId', input.exchangeId.trim());

  const response = await mobileFetch(`/api/encounters?${params.toString()}`, accessToken);
  const payload = await response.json() as { encounters?: Array<Record<string, unknown>>; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load meetings.');
  }

  return (payload.encounters ?? []).map((row) => mapEncounter(row));
}

function mapEncounter(row: Record<string, unknown>): EncounterPayload {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    personName: String(row.personName ?? row.person_name ?? ''),
    personEmail: String(row.personEmail ?? row.person_email ?? ''),
    contactId: typeof row.contactId === 'string' ? row.contactId : typeof row.contact_id === 'string' ? row.contact_id : undefined,
    exchangeId: typeof row.exchangeId === 'string' ? row.exchangeId : typeof row.exchange_id === 'string' ? row.exchange_id : undefined,
    startedAt: String(row.startedAt ?? row.started_at ?? ''),
    endedAt: String(row.endedAt ?? row.ended_at ?? ''),
    durationSeconds: typeof row.durationSeconds === 'number' ? row.durationSeconds : Number(row.duration_seconds ?? 0),
    consent: row.consent as EncounterPayload['consent'],
    transcript: String(row.transcript ?? ''),
    privateNotes: String(row.privateNotes ?? row.private_notes ?? ''),
    sharedSummary: String(row.sharedSummary ?? row.shared_summary ?? ''),
    actions: Array.isArray(row.actions) ? row.actions as EncounterAction[] : [],
    participants: Array.isArray(row.participants) ? row.participants as EncounterPayload['participants'] : [],
    status: (row.status as EncounterPayload['status']) ?? 'draft',
    shareToken: String(row.shareToken ?? row.share_token ?? ''),
    recording: row.recording as EncounterPayload['recording'],
  };
}

export function followUpsForPerson(items: FollowUpItem[], personName: string, personEmail?: string) {
  const email = personEmail?.trim().toLowerCase() || '';
  const name = personName.trim().toLowerCase();
  return items.filter((item) => {
    const itemEmail = item.personEmail.trim().toLowerCase();
    const itemName = item.personName.trim().toLowerCase();
    if (email && itemEmail && itemEmail === email) return true;
    if (!name || !itemName) return false;
    if (itemName === name) return true;
    return itemName.includes(name) || name.includes(itemName);
  });
}

export async function requestContactField(
  accessToken: string,
  input: {
    targetEmail: string;
    targetExchangeId?: string;
    fieldType: string;
    channel: string;
    followUpTitle: string;
    encounterId?: string;
    actionId?: string;
  },
) {
  const response = await mobileFetch('/api/contact-requests', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Could not send this request.');
  }
}
