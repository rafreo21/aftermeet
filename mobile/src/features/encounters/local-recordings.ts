import * as FileSystem from 'expo-file-system/legacy';

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

function expiryFor(retention: AudioRetention, createdAt: Date) {
  if (retention === 'never') return null;
  if (retention === 'after_transcription') return createdAt.toISOString();
  const hours = retention === '24_hours' ? 24 : 24 * 7;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function guessMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mp3';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'audio/m4a';
}

export async function saveLocalRecording(
  id: string,
  sourceUri: string,
  details: Omit<LocalRecordingMetadata, 'id' | 'fileSize' | 'mimeType' | 'expiresAt' | 'createdAt' | 'localUri'>,
): Promise<LocalRecordingMetadata> {
  await ensureRecordingsDirectory();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'm4a';
  const destUri = `${RECORDINGS_DIR}${id}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  const info = await FileSystem.getInfoAsync(destUri);
  const createdAt = new Date();
  return {
    ...details,
    id,
    localUri: destUri,
    fileSize: info.exists && 'size' in info ? (info.size ?? 0) : 0,
    mimeType: guessMimeType(destUri),
    expiresAt: expiryFor(details.retention, createdAt),
    createdAt: createdAt.toISOString(),
  };
}

export async function deleteLocalRecording(id: string) {
  await ensureRecordingsDirectory();
  for (const ext of ['m4a', 'wav', 'mp3', 'aac', 'caf']) {
    const uri = `${RECORDINGS_DIR}${id}.${ext}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export async function removeExpiredLocalRecordings() {
  await ensureRecordingsDirectory();
  const entries = await FileSystem.readDirectoryAsync(RECORDINGS_DIR).catch(() => [] as string[]);
  const now = Date.now();
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const metaUri = `${RECORDINGS_DIR}${name}`;
    try {
      const raw = await FileSystem.readAsStringAsync(metaUri);
      const meta = JSON.parse(raw) as { expiresAt?: string | null; audioFile?: string };
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() <= now) {
        if (meta.audioFile) await FileSystem.deleteAsync(meta.audioFile, { idempotent: true });
        await FileSystem.deleteAsync(metaUri, { idempotent: true });
      }
    } catch {
      // ignore corrupt index entries
    }
  }
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
