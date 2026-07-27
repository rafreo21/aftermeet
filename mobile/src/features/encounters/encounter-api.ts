import {
  guessRecordingFileName,
  guessRecordingMimeType,
  prepareAudioUpload,
} from '@/features/encounters/audio-upload';
import type { LocalRecordingMetadata } from '@/features/encounters/local-recordings';
import { mobileFetch } from '@/lib/mobile-api';

export type EncounterDraft = {
  title: string;
  personName: string;
  sharedSummary: string;
  privateNotes: string;
  followUp: string;
  followUpType: 'email' | 'linkedin' | 'call' | 'meeting' | 'send' | 'other';
};

export type EncounterAction = {
  id: string;
  title: string;
  channel: EncounterDraft['followUpType'];
  owner: 'me' | 'guest';
  dueAt: string;
  status: 'open' | 'completed' | 'snoozed';
};

export type EncounterPayload = {
  id: string;
  title: string;
  personName: string;
  personEmail: string;
  contactId?: string;
  exchangeId?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  consent: {
    confirmed: boolean;
    method: 'verbal' | 'written';
    confirmedAt: string;
    scriptVersion: '2026-07-26';
  };
  transcript: string;
  privateNotes: string;
  sharedSummary: string;
  actions: EncounterAction[];
  status: 'draft' | 'reviewed' | 'shared' | 'archived';
  shareToken: string;
  recording?: LocalRecordingMetadata;
};

export type InboundExchange = {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone?: string;
  visitor_company: string;
  visitor_role: string;
  note: string;
  status?: string;
  created_at?: string;
};

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export type EncounterSummary = {
  id: string;
  title: string;
  personName: string;
  sharedSummary: string;
  privateNotes: string;
  followUp: string;
  followUpType: EncounterDraft['followUpType'];
  status: EncounterPayload['status'];
  startedAt: string;
  endedAt: string;
};

function mapEncounterSummary(row: Record<string, unknown>): EncounterSummary {
  const actions = Array.isArray(row.actions) ? row.actions as EncounterAction[] : [];
  const followUp = actions[0];
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    personName: String(row.person_name ?? row.personName ?? ''),
    sharedSummary: String(row.shared_summary ?? row.sharedSummary ?? ''),
    privateNotes: String(row.private_notes ?? row.privateNotes ?? ''),
    followUp: followUp?.title ?? '',
    followUpType: followUp?.channel ?? 'other',
    status: (row.status as EncounterPayload['status']) ?? 'draft',
    startedAt: String(row.started_at ?? row.startedAt ?? ''),
    endedAt: String(row.ended_at ?? row.endedAt ?? ''),
  };
}

export async function fetchEncounters(accessToken: string) {
  const response = await mobileFetch('/api/encounters', accessToken);
  const payload = await response.json() as { encounters?: Array<Record<string, unknown>>; error?: string; preview?: boolean };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load your captures.');
  }
  return (payload.encounters ?? []).map(mapEncounterSummary);
}

export async function extractEncounterDraft(
  accessToken: string,
  transcript: string,
  hints?: {
    personName?: string;
    personEmail?: string;
    personPhone?: string;
    people?: Array<{ name: string; email?: string; phone?: string }>;
  },
) {
  const response = await mobileFetch('/api/encounters/extract', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      personName: hints?.personName?.trim() || '',
      personEmail: hints?.personEmail?.trim() || '',
      personPhone: hints?.personPhone?.trim() || '',
      people: hints?.people ?? [],
    }),
  });
  const payload = await response.json() as {
    draft?: EncounterDraft;
    source?: 'ai' | 'heuristic';
    uncertainFields?: string[];
    error?: string;
  };
  if (!response.ok || !payload.draft) {
    throw new Error(payload.error || 'Could not suggest meeting context.');
  }
  return payload;
}

export async function fetchInboundExchanges(accessToken: string) {
  const response = await mobileFetch('/api/cards/exchanges', accessToken);
  const payload = await response.json() as { exchanges?: InboundExchange[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load inbound captures.');
  }
  return payload.exchanges ?? [];
}

export function buildEncounterPayload(input: {
  id?: string;
  transcript: string;
  title: string;
  personName: string;
  personEmail?: string;
  contactId?: string;
  exchangeId?: string;
  sharedSummary: string;
  privateNotes: string;
  followUp: string;
  followUpType: EncounterDraft['followUpType'];
  dueAt?: string;
  consentMethod?: 'verbal' | 'written';
  status?: EncounterPayload['status'];
  shareToken?: string;
  durationSeconds?: number;
  startedAt?: string;
  recording?: LocalRecordingMetadata;
}): EncounterPayload {
  const now = new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round(input.durationSeconds ?? 0));
  const startedAt = input.startedAt || new Date(Date.now() - durationSeconds * 1000).toISOString();
  return {
    id: input.id || createId(),
    title: input.title.trim() || `Meeting with ${input.personName.trim() || 'someone new'}`,
    personName: input.personName.trim(),
    personEmail: input.personEmail?.trim() || '',
    contactId: input.contactId || undefined,
    exchangeId: input.exchangeId || undefined,
    startedAt,
    endedAt: now,
    durationSeconds,
    consent: {
      confirmed: true,
      method: input.consentMethod || 'verbal',
      confirmedAt: now,
      scriptVersion: '2026-07-26',
    },
    transcript: input.transcript.trim(),
    privateNotes: input.privateNotes.trim(),
    sharedSummary: input.sharedSummary.trim(),
    recording: input.recording,
    actions: input.followUp.trim() ? [{
      id: createId(),
      title: input.followUp.trim(),
      channel: input.followUpType,
      owner: 'me',
      dueAt: input.dueAt?.trim() || now,
      status: 'open',
    }] : [],
    status: input.status || 'draft',
    shareToken: input.shareToken || createId().replace(/-/g, ''),
  };
}

export async function transcribeEncounterAudio(
  accessToken: string,
  uri: string,
  options?: { fileName?: string; mimeType?: string; language?: string },
) {
  const prepared = await prepareAudioUpload(uri, options);
  const response = await mobileFetch('/api/encounters/transcribe', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: prepared.base64,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      lang: options?.language,
    }),
  });
  const raw = await response.text();
  let payload: {
    transcript?: string;
    source?: 'ai' | 'unavailable';
    unavailable?: string;
    error?: string;
  } = {};
  try {
    payload = raw ? JSON.parse(raw) as typeof payload : {};
  } catch {
    if (response.status === 405 || response.status === 404) {
      throw new Error('Transcription API is not deployed yet. Deploy the latest web app, then try again.');
    }
    throw new Error(`Transcription failed (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(payload.error || `Transcription failed (${response.status}).`);
  }
  return {
    transcript: payload.transcript?.trim() || '',
    source: payload.source || 'unavailable',
    unavailable: payload.unavailable,
  };
}

export async function uploadEncounterRecording(
  accessToken: string,
  encounterId: string,
  uri: string,
  mimeType?: string,
) {
  const formData = new FormData();
  formData.append('audio', {
    uri,
    name: guessRecordingFileName(uri),
    type: mimeType || guessRecordingMimeType(uri),
  } as unknown as Blob);

  const response = await mobileFetch(`/api/encounters/${encounterId}/recording`, accessToken, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json() as {
    ok?: boolean;
    error?: string;
    recording?: { sharedAudioUrl?: string };
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Could not upload this recording for sharing.');
  }
  return payload.recording;
}

export async function saveEncounter(accessToken: string, encounter: EncounterPayload) {
  const response = await mobileFetch('/api/encounters', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: encounter.id,
      title: encounter.title,
      personName: encounter.personName,
      personEmail: encounter.personEmail,
      contactId: encounter.contactId ?? null,
      exchangeId: encounter.exchangeId ?? null,
      startedAt: encounter.startedAt,
      endedAt: encounter.endedAt,
      durationSeconds: encounter.durationSeconds,
      consent: encounter.consent,
      transcript: encounter.transcript,
      privateNotes: encounter.privateNotes,
      sharedSummary: encounter.sharedSummary,
      actions: encounter.actions,
      status: encounter.status,
      shareToken: encounter.shareToken,
      recording: encounter.recording
        ? {
            durationSeconds: encounter.recording.durationSeconds,
            fileSize: encounter.recording.fileSize,
            mimeType: encounter.recording.mimeType,
            source: encounter.recording.source,
            retention: encounter.recording.retention,
            expiresAt: encounter.recording.expiresAt,
            createdAt: encounter.recording.createdAt,
            audioLocation: 'user_device',
          }
        : null,
    }),
  });
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Could not save this meeting.');
  }
}

export async function getEncounter(accessToken: string, id: string) {
  const response = await mobileFetch(`/api/encounters/${id}`, accessToken);
  const payload = await response.json() as { encounter?: EncounterPayload; error?: string };
  if (!response.ok || !payload.encounter) {
    throw new Error(payload.error || 'Encounter not found.');
  }
  return payload.encounter;
}

export async function deleteEncounter(accessToken: string, id: string) {
  const response = await mobileFetch(`/api/encounters/${id}`, accessToken, { method: 'DELETE' });
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Could not delete this capture.');
  }
}

export async function generateOutboundDraft(
  accessToken: string,
  encounter: EncounterPayload,
) {
  if (!encounter.actions[0]) return null;
  const response = await mobileFetch('/api/encounters/outbound-draft', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encounter,
      action: encounter.actions[0],
    }),
  });
  const payload = await response.json() as { draft?: { body?: string; subject?: string }; error?: string };
  if (!response.ok || !payload.draft?.body) {
    throw new Error(payload.error || 'Could not draft a follow-up message.');
  }
  return payload.draft.body;
}

export async function fetchPublicCardName(baseUrl: string, slug: string) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/cards/public/${encodeURIComponent(slug)}`);
  if (!response.ok) return null;
  const payload = await response.json() as { card?: { full_name?: string } };
  return payload.card?.full_name?.trim() || null;
}
