import * as FileSystem from 'expo-file-system/legacy';

import { readEnv } from '@/lib/env';

export type AudioRetention = 'after_transcription' | '24_hours' | '7_days' | 'never';

export type LocalRecordingMetadata = {
  id: string;
  durationSeconds: number;
  fileSize: number;
  mimeType: string;
  source: 'recorded' | 'imported';
  retention: AudioRetention;
  expiresAt: string | null;
  createdAt: string;
  localUri: string;
  storagePath?: string;
  sharedAudioUrl?: string;
};

const RECORDINGS_DIR = `${FileSystem.documentDirectory}aftermeet-recordings/`;

export function recordingsDirectory() {
  return RECORDINGS_DIR;
}

export async function ensureRecordingsDirectory() {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

function metaUri(id: string) {
  return `${RECORDINGS_DIR}${id}.json`;
}

function expiryFor(retention: AudioRetention, createdAt: Date) {
  if (retention === 'never') return null;
  if (retention === 'after_transcription') return createdAt.toISOString();
  const hours = retention === '24_hours' ? 24 : 24 * 7;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function guessMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.caf')) return 'audio/x-caf';
  return 'audio/mp4';
}

function guessExtension(uri: string) {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (ext && ['wav', 'm4a', 'mp3', 'aac', 'caf'].includes(ext)) return ext;
  return 'm4a';
}

async function writeRecordingIndex(metadata: LocalRecordingMetadata) {
  await FileSystem.writeAsStringAsync(metaUri(metadata.id), JSON.stringify({
    id: metadata.id,
    audioFile: metadata.localUri,
    expiresAt: metadata.expiresAt,
    durationSeconds: metadata.durationSeconds,
    mimeType: metadata.mimeType,
    storagePath: metadata.storagePath,
    sharedAudioUrl: metadata.sharedAudioUrl,
  }));
}

export async function saveLocalRecording(
  id: string,
  sourceUri: string,
  details: Omit<LocalRecordingMetadata, 'id' | 'fileSize' | 'mimeType' | 'expiresAt' | 'createdAt' | 'localUri'>,
): Promise<LocalRecordingMetadata> {
  await ensureRecordingsDirectory();
  const ext = guessExtension(sourceUri);
  const destUri = `${RECORDINGS_DIR}${id}.${ext}`;
  const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
  if (!sourceInfo.exists) {
    throw new Error('Recording file is no longer available on this device.');
  }
  if (sourceUri !== destUri) {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  }
  const info = await FileSystem.getInfoAsync(destUri);
  const createdAt = new Date();
  const metadata: LocalRecordingMetadata = {
    ...details,
    id,
    localUri: destUri,
    fileSize: info.exists && 'size' in info ? (info.size ?? 0) : 0,
    mimeType: guessMimeType(destUri),
    expiresAt: expiryFor(details.retention, createdAt),
    createdAt: createdAt.toISOString(),
  };
  await writeRecordingIndex(metadata);
  return metadata;
}

export async function readLocalRecordingMetadata(id: string): Promise<LocalRecordingMetadata | null> {
  await ensureRecordingsDirectory();
  try {
    const raw = await FileSystem.readAsStringAsync(metaUri(id));
    const parsed = JSON.parse(raw) as {
      id?: string;
      audioFile?: string;
      durationSeconds?: number;
      mimeType?: string;
      expiresAt?: string | null;
      storagePath?: string;
      sharedAudioUrl?: string;
    };
    if (!parsed.audioFile) return null;
    const info = await FileSystem.getInfoAsync(parsed.audioFile);
    if (!info.exists) return null;
    return {
      id,
      localUri: parsed.audioFile,
      durationSeconds: parsed.durationSeconds ?? 0,
      fileSize: info.exists && 'size' in info ? (info.size ?? 0) : 0,
      mimeType: parsed.mimeType || guessMimeType(parsed.audioFile),
      source: 'recorded',
      retention: '7_days',
      expiresAt: parsed.expiresAt ?? null,
      createdAt: parsed.expiresAt ?? new Date().toISOString(),
      storagePath: parsed.storagePath,
      sharedAudioUrl: parsed.sharedAudioUrl,
    };
  } catch {
    return null;
  }
}

export async function deleteLocalRecording(id: string) {
  await ensureRecordingsDirectory();
  for (const ext of ['m4a', 'wav', 'mp3', 'aac', 'caf']) {
    const uri = `${RECORDINGS_DIR}${id}.${ext}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }
  const index = metaUri(id);
  const info = await FileSystem.getInfoAsync(index);
  if (info.exists) await FileSystem.deleteAsync(index, { idempotent: true });
}

export async function removeExpiredLocalRecordings() {
  await ensureRecordingsDirectory();
  const entries = await FileSystem.readDirectoryAsync(RECORDINGS_DIR).catch(() => [] as string[]);
  const now = Date.now();
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const indexUri = `${RECORDINGS_DIR}${name}`;
    try {
      const raw = await FileSystem.readAsStringAsync(indexUri);
      const meta = JSON.parse(raw) as { expiresAt?: string | null; audioFile?: string; id?: string };
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() <= now) {
        if (meta.id) await deleteLocalRecording(meta.id);
      }
    } catch {
      // ignore corrupt index entries
    }
  }
}

export async function findLocalRecordingUri(id: string) {
  const metadata = await readLocalRecordingMetadata(id);
  if (metadata?.localUri) return metadata.localUri;

  await ensureRecordingsDirectory();
  for (const ext of ['wav', 'm4a', 'mp3', 'aac', 'caf']) {
    const uri = `${RECORDINGS_DIR}${id}.${ext}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  }
  return null;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function resolveSharedRecordingUrl(recording?: { sharedAudioUrl?: string | null }) {
  if (!recording?.sharedAudioUrl) return null;
  const base = readEnv()?.publicCardBaseUrl?.replace(/\/+$/, '');
  if (!base) {
    return recording.sharedAudioUrl.startsWith('http') ? recording.sharedAudioUrl : null;
  }
  if (recording.sharedAudioUrl.startsWith('http')) return recording.sharedAudioUrl;
  return `${base}${recording.sharedAudioUrl.startsWith('/') ? '' : '/'}${recording.sharedAudioUrl}`;
}

export async function resolveEncounterRecordingUri(
  encounterId: string,
  recording?: { sharedAudioUrl?: string | null },
) {
  const localUri = await findLocalRecordingUri(encounterId);
  if (localUri) return localUri;
  return resolveSharedRecordingUrl(recording);
}
