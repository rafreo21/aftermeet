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
  cloudExpiresAt?: string | null;
  audioLocation?: 'user_device' | 'server' | 'google_drive' | 'onedrive';
  driveFileId?: string;
  driveWebViewUrl?: string;
  oneDriveItemId?: string;
  oneDriveWebUrl?: string;
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
  if (retention === 'never' || retention === 'after_transcription') return null;
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
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt,
    durationSeconds: metadata.durationSeconds,
    fileSize: metadata.fileSize,
    mimeType: metadata.mimeType,
    source: metadata.source,
    retention: metadata.retention,
    storagePath: metadata.storagePath,
    sharedAudioUrl: metadata.sharedAudioUrl,
    cloudExpiresAt: metadata.cloudExpiresAt,
    audioLocation: metadata.audioLocation,
    driveFileId: metadata.driveFileId,
    driveWebViewUrl: metadata.driveWebViewUrl,
    oneDriveItemId: metadata.oneDriveItemId,
    oneDriveWebUrl: metadata.oneDriveWebUrl,
  }));
}

export async function saveLocalRecording(
  id: string,
  sourceUri: string,
  details: Omit<LocalRecordingMetadata, 'id' | 'fileSize' | 'mimeType' | 'expiresAt' | 'createdAt' | 'localUri'>,
): Promise<LocalRecordingMetadata> {
  await ensureRecordingsDirectory();
  const ext = guessExtension(sourceUri);
  let destUri = `${RECORDINGS_DIR}${id}.${ext}`;
  const destInfo = await FileSystem.getInfoAsync(destUri);
  if (!destInfo.exists) {
    const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
    if (sourceInfo.exists && sourceUri !== destUri) {
      await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    } else {
      const existingUri = await scanLocalRecordingFile(id);
      if (existingUri) {
        destUri = existingUri;
      } else if (!sourceInfo.exists) {
        throw new Error('Recording file is no longer available on this device.');
      }
    }
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

async function scanLocalRecordingFile(id: string) {
  await ensureRecordingsDirectory();
  for (const ext of ['wav', 'm4a', 'mp3', 'aac', 'caf']) {
    const uri = `${RECORDINGS_DIR}${id}.${ext}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  }
  return null;
}
export async function readLocalRecordingMetadata(id: string): Promise<LocalRecordingMetadata | null> {
  await ensureRecordingsDirectory();
  try {
    const raw = await FileSystem.readAsStringAsync(metaUri(id));
    const parsed = JSON.parse(raw) as {
      id?: string;
      audioFile?: string;
      durationSeconds?: number;
      fileSize?: number;
      mimeType?: string;
      source?: LocalRecordingMetadata['source'];
      retention?: AudioRetention;
      createdAt?: string;
      expiresAt?: string | null;
      storagePath?: string;
      sharedAudioUrl?: string;
      cloudExpiresAt?: string | null;
      audioLocation?: LocalRecordingMetadata['audioLocation'];
      driveFileId?: string;
      driveWebViewUrl?: string;
      oneDriveItemId?: string;
      oneDriveWebUrl?: string;
    };
    let audioFile = parsed.audioFile ?? (await scanLocalRecordingFile(id)) ?? undefined;
    if (!audioFile) return null;
    let info = await FileSystem.getInfoAsync(audioFile);
    if (!info.exists) {
      const fallback = await scanLocalRecordingFile(id);
      if (!fallback) return null;
      audioFile = fallback;
      info = await FileSystem.getInfoAsync(audioFile);
    }
    return {
      id,
      localUri: audioFile,
      durationSeconds: parsed.durationSeconds ?? 0,
      fileSize: info.exists && 'size' in info ? (info.size ?? parsed.fileSize ?? 0) : (parsed.fileSize ?? 0),
      mimeType: parsed.mimeType || guessMimeType(audioFile),
      source: parsed.source === 'imported' ? 'imported' : 'recorded',
      retention: parsed.retention ?? '7_days',
      expiresAt: parsed.expiresAt ?? null,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      storagePath: parsed.storagePath,
      sharedAudioUrl: parsed.sharedAudioUrl,
      cloudExpiresAt: parsed.cloudExpiresAt ?? null,
      audioLocation: parsed.audioLocation,
      driveFileId: parsed.driveFileId,
      driveWebViewUrl: parsed.driveWebViewUrl,
      oneDriveItemId: parsed.oneDriveItemId,
      oneDriveWebUrl: parsed.oneDriveWebUrl,
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
  const scanned = await scanLocalRecordingFile(id);
  if (scanned) return scanned;

  try {
    const raw = await FileSystem.readAsStringAsync(metaUri(id));
    const parsed = JSON.parse(raw) as { audioFile?: string };
    if (parsed.audioFile) {
      const info = await FileSystem.getInfoAsync(parsed.audioFile);
      if (info.exists) return parsed.audioFile;
    }
  } catch {
    // ignore missing or invalid index
  }
  return null;
}

export async function updateLocalRecordingSharedUrl(
  id: string,
  sharedAudioUrl: string,
  cloud?: Pick<LocalRecordingMetadata, 'storagePath' | 'cloudExpiresAt' | 'audioLocation' | 'fileSize' | 'mimeType'>,
) {
  const metadata = await readLocalRecordingMetadata(id);
  if (!metadata) return;
  await writeRecordingIndex({
    ...metadata,
    ...cloud,
    sharedAudioUrl,
    audioLocation: cloud?.audioLocation ?? (sharedAudioUrl ? 'server' : metadata.audioLocation),
  });
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
