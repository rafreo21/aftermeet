import {
  MAX_BASE64_TRANSCRIBE_BYTES,
  guessRecordingFileName,
  guessRecordingMimeType,
  prepareAudioFile,
  prepareAudioUpload,
  type PreparedAudioUpload,
} from '@/features/encounters/audio-upload';
import type { LocalRecordingMetadata } from '@/features/encounters/local-recordings';
import { mobileFetch } from '@/lib/mobile-api';
import {
  defaultFollowUpTitle,
  displayFollowUpTitle,
  type FollowUpChannel,
} from '@/features/follow-ups/follow-up-channels';

export type FollowUpChannelId = FollowUpChannel | 'send' | 'other';

export type EncounterDraft = {
  title: string;
  personName: string;
  sharedSummary: string;
  privateNotes: string;
  followUp: string;
  followUpType: FollowUpChannelId;
};

export type EncounterAction = {
  id: string;
  title: string;
  channel: FollowUpChannelId;
  owner: 'me' | 'guest';
  dueAt: string;
  status: 'open' | 'completed' | 'snoozed';
  assigneeName?: string;
  assigneeEmail?: string;
  groupId?: string;
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
  people?: Array<{ name: string; email?: string }>;
  contactId?: string;
  exchangeId?: string;
  sharedSummary: string;
  privateNotes: string;
  followUp?: string;
  followUpType?: FollowUpChannelId;
  followUpChannels?: FollowUpChannel[];
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
  const followUpTitle = input.followUp?.trim() ?? '';
  const sanitizedFollowUpTitle = followUpTitle && !/^[\d+\s()-]+$/.test(followUpTitle)
    ? followUpTitle
    : '';
  const channels = (input.followUpChannels?.length
    ? input.followUpChannels
    : sanitizedFollowUpTitle || input.followUpType
      ? [input.followUpType ?? 'email'] as FollowUpChannel[]
      : []) as FollowUpChannel[];
  const meetingPeople = (input.people ?? [])
    .map((person) => ({
      name: person.name.trim(),
      email: person.email?.trim() ?? '',
    }))
    .filter((person) => person.name.length >= 2);

  const actions: EncounterAction[] = [];
  if (channels.length) {
    const assignees = meetingPeople.length >= 1
    ? meetingPeople
    : [{ name: input.personName.trim(), email: input.personEmail?.trim() ?? '' }];

    for (const assignee of assignees) {
      if (!assignee.name.trim()) continue;
      const groupId = createId();
      for (const channel of channels.slice(0, 2)) {
        actions.push({
          id: createId(),
          title: displayFollowUpTitle(sanitizedFollowUpTitle, channel),
          channel,
          owner: 'me',
          dueAt: input.dueAt?.trim() || '',
          status: 'open',
          assigneeName: assignee.name,
          assigneeEmail: assignee.email,
          groupId: channels.length > 1 ? groupId : undefined,
        });
      }
    }
  }

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
    actions,
    status: input.status || 'draft',
    shareToken: input.shareToken || createId().replace(/-/g, ''),
  };
}

export function applyEncounterFollowUpSettings(
  encounter: EncounterPayload,
  input: {
    followUpChannels: FollowUpChannel[];
    dueAt: string;
    privateNotes: string;
  },
): EncounterPayload {
  const rebuilt = buildEncounterPayload({
    id: encounter.id,
    transcript: encounter.transcript,
    title: encounter.title,
    personName: encounter.personName,
    personEmail: encounter.personEmail,
    sharedSummary: encounter.sharedSummary,
    privateNotes: input.privateNotes,
    followUpChannels: input.followUpChannels,
    dueAt: input.dueAt,
    consentMethod: encounter.consent.method,
    status: encounter.status,
    durationSeconds: encounter.durationSeconds,
    startedAt: encounter.startedAt,
    recording: encounter.recording,
    shareToken: encounter.shareToken,
  });

  return {
    ...encounter,
    privateNotes: rebuilt.privateNotes,
    actions: rebuilt.actions,
  };
}

type TranscribePayload = {
  transcript?: string;
  source?: 'ai' | 'unavailable';
  unavailable?: string;
  error?: string;
};

function transcribeFailureMessage(status: number, payload: TranscribePayload, raw: string) {
  if (payload.error?.trim()) return payload.error.trim();
  if (status === 401) return 'Your session has expired. Sign in again and retry the import.';
  if (status === 404 || status === 405) {
    return 'Transcription API is not deployed yet. Deploy the latest web app, then try again.';
  }
  if (status === 413) {
    return 'Recording is too large to upload. Try a shorter clip or a compressed M4A/MP3 file.';
  }
  if (status >= 500) return 'Transcription service is temporarily unavailable. Try again in a moment.';
  if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
    return 'Transcription request failed. The recording may be too large. Try a shorter clip.';
  }
  return `Transcription failed (${status}).`;
}

async function parseTranscribeResponse(response: Response) {
  const raw = await response.text();
  let payload: TranscribePayload = {};
  try {
    payload = raw ? JSON.parse(raw) as TranscribePayload : {};
  } catch {
    throw new Error(transcribeFailureMessage(response.status, payload, raw));
  }
  if (!response.ok) {
    throw new Error(transcribeFailureMessage(response.status, payload, raw));
  }
  return {
    transcript: payload.transcript?.trim() || '',
    source: payload.source || 'unavailable' as const,
    unavailable: payload.unavailable,
  };
}

async function transcribeViaMultipart(
  accessToken: string,
  prepared: PreparedAudioUpload,
  language?: string,
) {
  const formData = new FormData();
  formData.append('audio', {
    uri: prepared.uri,
    name: prepared.fileName,
    type: prepared.mimeType,
  } as unknown as Blob);
  formData.append('fileName', prepared.fileName);
  formData.append('mimeType', prepared.mimeType);
  if (language?.trim()) formData.append('lang', language.trim());

  const response = await mobileFetch('/api/encounters/transcribe', accessToken, {
    method: 'POST',
    body: formData,
  });
  return parseTranscribeResponse(response);
}

async function transcribeViaBase64Json(
  accessToken: string,
  prepared: PreparedAudioUpload & { base64: string },
  language?: string,
) {
  const response = await mobileFetch('/api/encounters/transcribe', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: prepared.base64,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      lang: language,
    }),
  });
  return parseTranscribeResponse(response);
}

export async function transcribeEncounterAudio(
  accessToken: string,
  uri: string,
  options?: { fileName?: string; mimeType?: string; language?: string },
) {
  const prepared = await prepareAudioFile(uri, options);
  const canUseBase64 = prepared.size === 0 || prepared.size <= MAX_BASE64_TRANSCRIBE_BYTES;

  if (canUseBase64) {
    try {
      const withBase64 = await prepareAudioUpload(uri, options);
      return await transcribeViaBase64Json(accessToken, withBase64, options?.language);
    } catch (error) {
      if (prepared.size > MAX_BASE64_TRANSCRIBE_BYTES) throw error;
      try {
        return await transcribeViaMultipart(accessToken, prepared, options?.language);
      } catch {
        throw error;
      }
    }
  }

  try {
    return await transcribeViaMultipart(accessToken, prepared, options?.language);
  } catch (error) {
    if (prepared.size <= MAX_BASE64_TRANSCRIBE_BYTES) {
      const withBase64 = await prepareAudioUpload(uri, options);
      return await transcribeViaBase64Json(accessToken, withBase64, options?.language);
    }
    throw error;
  }
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
