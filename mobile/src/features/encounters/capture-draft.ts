import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EncounterPayload } from '@/features/encounters/encounter-api';
import type { AudioRetention } from '@/features/encounters/local-recordings';
import {
  migrateGatherPeople,
  syncLegacyPersonFields,
  type GatherPerson,
} from '@/features/encounters/gather-people';

export type { GatherPerson };
export { MAX_GATHER_PEOPLE } from '@/features/encounters/gather-people';

export type CaptureWizardDraft = {
  step: number;
  encounterId: string;
  consent: boolean;
  consentMethod: 'verbal' | 'written';
  durationSeconds: number;
  recordingUri: string;
  recordingSource: 'recorded' | 'imported' | '';
  retention: AudioRetention;
  people: GatherPerson[];
  personName: string;
  personEmail: string;
  personPhone: string;
  personLinkedIn: string;
  personAcknowledged: boolean;
  contactId: string;
  exchangeId: string;
  transcript: string;
  title: string;
  privateNotes: string;
  sharedSummary: string;
  followUp: string;
  followUpType: EncounterPayload['actions'][number]['channel'];
  dueAt: string;
  gatherSessionStartedAt: string;
  importFileName: string;
  importMimeType: string;
  updatedAt: string;
};

export type CaptureDraftSummary = {
  encounterId: string;
  updatedAt: string;
  step: number;
  personName: string;
  title: string;
  transcriptPreview: string;
};

export const CAPTURE_DRAFT_KEY = 'aftermeet-capture-wizard-v1';
export const CAPTURE_DRAFTS_INDEX_KEY = 'aftermeet-capture-drafts-index-v2';
export const AUTH_RETURN_KEY = 'aftermeet-auth-return-v1';

function createEncounterId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function draftStorageKey(encounterId: string) {
  return `aftermeet-capture-draft-${encounterId}`;
}

function normalizeDraft(parsed: Partial<CaptureWizardDraft>): CaptureWizardDraft {
  const people = migrateGatherPeople(parsed);
  const synced = syncLegacyPersonFields(people);
  return {
    ...EMPTY_CAPTURE_DRAFT,
    ...parsed,
    ...synced,
    people: synced.people ?? [],
    encounterId: parsed.encounterId || createEncounterId(),
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    gatherSessionStartedAt: parsed.gatherSessionStartedAt || '',
    step: typeof parsed.step === 'number' && parsed.step >= 0 && parsed.step <= 3 ? parsed.step : 0,
    privateNotes: '',
  };
}

function toSummary(draft: CaptureWizardDraft): CaptureDraftSummary {
  return {
    encounterId: draft.encounterId,
    updatedAt: draft.updatedAt,
    step: draft.step,
    personName: draft.personName.trim(),
    title: draft.title.trim(),
    transcriptPreview: draft.transcript.trim().slice(0, 120),
  };
}

export const EMPTY_CAPTURE_DRAFT: CaptureWizardDraft = {
  step: 0,
  encounterId: createEncounterId(),
  consent: false,
  consentMethod: 'verbal',
  durationSeconds: 0,
  recordingUri: '',
  recordingSource: '',
  retention: '7_days',
  people: [],
  personName: '',
  personEmail: '',
  personPhone: '',
  personLinkedIn: '',
  personAcknowledged: false,
  contactId: '',
  exchangeId: '',
  transcript: '',
  title: '',
  privateNotes: '',
  sharedSummary: '',
  followUp: '',
  followUpType: 'email',
  dueAt: '',
  gatherSessionStartedAt: '',
  importFileName: '',
  importMimeType: '',
  updatedAt: new Date().toISOString(),
};

export function createFreshCaptureDraft(): CaptureWizardDraft {
  const now = new Date().toISOString();
  return {
    ...EMPTY_CAPTURE_DRAFT,
    encounterId: createEncounterId(),
    gatherSessionStartedAt: now,
    updatedAt: now,
  };
}

async function readDraftIndex(): Promise<CaptureDraftSummary[]> {
  try {
    const raw = await AsyncStorage.getItem(CAPTURE_DRAFTS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaptureDraftSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDraftIndex(entries: CaptureDraftSummary[]) {
  const sorted = [...entries].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
  await AsyncStorage.setItem(CAPTURE_DRAFTS_INDEX_KEY, JSON.stringify(sorted));
}

async function migrateLegacyDraftIfNeeded() {
  const legacyRaw = await AsyncStorage.getItem(CAPTURE_DRAFT_KEY);
  if (!legacyRaw) return;

  try {
    const parsed = JSON.parse(legacyRaw) as Partial<CaptureWizardDraft>;
    const draft = normalizeDraft(parsed);
    if (hasCaptureDraftProgress(draft)) {
      await AsyncStorage.setItem(draftStorageKey(draft.encounterId), JSON.stringify(draft));
      const index = await readDraftIndex();
      const next = index.filter((item) => item.encounterId !== draft.encounterId);
      next.unshift(toSummary(draft));
      await writeDraftIndex(next);
    }
  } catch {
    // ignore corrupt legacy draft
  }

  await AsyncStorage.removeItem(CAPTURE_DRAFT_KEY);
}

export async function listCaptureDrafts(): Promise<CaptureDraftSummary[]> {
  await migrateLegacyDraftIfNeeded();
  const index = await readDraftIndex();
  const valid: CaptureDraftSummary[] = [];

  for (const entry of index) {
    const raw = await AsyncStorage.getItem(draftStorageKey(entry.encounterId));
    if (!raw) continue;
    try {
      const draft = normalizeDraft(JSON.parse(raw) as Partial<CaptureWizardDraft>);
      if (!hasCaptureDraftProgress(draft)) continue;
      valid.push(toSummary(draft));
    } catch {
      // ignore corrupt draft
    }
  }

  if (valid.length !== index.length) {
    await writeDraftIndex(valid);
  }

  return valid;
}

export async function readCaptureDraft(encounterId?: string): Promise<CaptureWizardDraft | null> {
  await migrateLegacyDraftIfNeeded();

  if (encounterId) {
    const raw = await AsyncStorage.getItem(draftStorageKey(encounterId));
    if (!raw) return null;
    try {
      return normalizeDraft(JSON.parse(raw) as Partial<CaptureWizardDraft>);
    } catch {
      return null;
    }
  }

  const drafts = await listCaptureDrafts();
  if (!drafts[0]) return null;
  return readCaptureDraft(drafts[0].encounterId);
}

export async function writeCaptureDraft(draft: CaptureWizardDraft) {
  const next = normalizeDraft({
    ...draft,
    updatedAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(draftStorageKey(next.encounterId), JSON.stringify(next));

  const index = await readDraftIndex();
  const filtered = index.filter((item) => item.encounterId !== next.encounterId);
  if (hasCaptureDraftProgress(next)) {
    filtered.unshift(toSummary(next));
  }
  await writeDraftIndex(filtered);
}

export async function deleteCaptureDraft(encounterId: string) {
  await AsyncStorage.removeItem(draftStorageKey(encounterId));
  const index = await readDraftIndex();
  await writeDraftIndex(index.filter((item) => item.encounterId !== encounterId));
}

export async function clearCaptureDraft(encounterId?: string) {
  if (encounterId) {
    await deleteCaptureDraft(encounterId);
    return;
  }
  const drafts = await listCaptureDrafts();
  await Promise.all(drafts.map((draft) => deleteCaptureDraft(draft.encounterId)));
}

export function hasCaptureDraftProgress(draft: CaptureWizardDraft) {
  return draft.step > 0
    || draft.consent
    || draft.transcript.trim().length > 0
    || draft.recordingUri.trim().length > 0
    || draft.people.length > 0
    || draft.title.trim().length > 0
    || draft.sharedSummary.trim().length > 0
    || draft.followUp.trim().length > 0;
}

export async function setAuthReturnPath(path: string) {
  await AsyncStorage.setItem(AUTH_RETURN_KEY, path);
}

export async function consumeAuthReturnPath() {
  const path = await AsyncStorage.getItem(AUTH_RETURN_KEY);
  await AsyncStorage.removeItem(AUTH_RETURN_KEY);
  return path;
}
