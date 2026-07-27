import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EncounterPayload } from '@/features/encounters/encounter-api';
import type { AudioRetention } from '@/features/encounters/local-recordings';

export type CaptureWizardDraft = {
  step: number;
  encounterId: string;
  consent: boolean;
  consentMethod: 'verbal' | 'written';
  durationSeconds: number;
  recordingUri: string;
  recordingSource: 'recorded' | 'imported' | '';
  retention: AudioRetention;
  personName: string;
  personEmail: string;
  contactId: string;
  exchangeId: string;
  transcript: string;
  title: string;
  privateNotes: string;
  sharedSummary: string;
  followUp: string;
  followUpType: EncounterPayload['actions'][number]['channel'];
  dueAt: string;
};

export const CAPTURE_DRAFT_KEY = 'aftermeet-capture-wizard-v1';
export const AUTH_RETURN_KEY = 'aftermeet-auth-return-v1';

function createEncounterId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
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
  personName: '',
  personEmail: '',
  contactId: '',
  exchangeId: '',
  transcript: '',
  title: '',
  privateNotes: '',
  sharedSummary: '',
  followUp: '',
  followUpType: 'email',
  dueAt: '',
};

export function createFreshCaptureDraft(): CaptureWizardDraft {
  return { ...EMPTY_CAPTURE_DRAFT, encounterId: createEncounterId() };
}

export async function readCaptureDraft(): Promise<CaptureWizardDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(CAPTURE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CaptureWizardDraft>;
    return {
      ...EMPTY_CAPTURE_DRAFT,
      ...parsed,
      encounterId: parsed.encounterId || createEncounterId(),
      step: typeof parsed.step === 'number' && parsed.step >= 0 && parsed.step <= 3 ? parsed.step : 0,
    };
  } catch {
    return null;
  }
}

export async function writeCaptureDraft(draft: CaptureWizardDraft) {
  await AsyncStorage.setItem(CAPTURE_DRAFT_KEY, JSON.stringify(draft));
}

export async function clearCaptureDraft() {
  await AsyncStorage.removeItem(CAPTURE_DRAFT_KEY);
}

export async function setAuthReturnPath(path: string) {
  await AsyncStorage.setItem(AUTH_RETURN_KEY, path);
}

export async function consumeAuthReturnPath() {
  const path = await AsyncStorage.getItem(AUTH_RETURN_KEY);
  await AsyncStorage.removeItem(AUTH_RETURN_KEY);
  return path;
}
