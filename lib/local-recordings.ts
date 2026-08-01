export type AudioRetention = "after_transcription" | "24_hours" | "7_days" | "never";

export type LocalRecordingMetadata = {
  id: string;
  durationSeconds: number;
  fileSize: number;
  mimeType: string;
  source: "recorded" | "imported";
  retention: AudioRetention;
  expiresAt: string | null;
  createdAt: string;
  audioLocation?: "user_device" | "server" | "google_drive" | "onedrive";
  storagePath?: string;
  sharedAudioUrl?: string;
  cloudExpiresAt?: string | null;
  driveFileId?: string;
  driveWebViewUrl?: string;
  oneDriveItemId?: string;
  oneDriveWebUrl?: string;
};

const DATABASE_NAME = "aftermeet-private-audio";
const STORE_NAME = "recordings";
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open private audio storage."));
  });
}

function expiryFor(retention: AudioRetention, createdAt: Date) {
  if (retention === "never") return null;
  if (retention === "after_transcription") return createdAt.toISOString();
  const hours = retention === "24_hours" ? 24 : 24 * 7;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export async function saveLocalRecording(
  id: string,
  blob: Blob,
  details: Omit<LocalRecordingMetadata, "id" | "fileSize" | "mimeType" | "expiresAt" | "createdAt">,
) {
  const createdAt = new Date();
  const metadata: LocalRecordingMetadata = {
    ...details,
    id,
    fileSize: blob.size,
    mimeType: blob.type || "audio/wav",
    expiresAt: expiryFor(details.retention, createdAt),
    createdAt: createdAt.toISOString(),
  };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ blob, metadata }, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not save recording on this device."));
  });
  database.close();
  return metadata;
}

export async function deleteLocalRecording(id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not delete local recording."));
  });
  database.close();
}

export async function readLocalRecording(id: string) {
  const database = await openDatabase();
  const result = await new Promise<{ blob: Blob; metadata: LocalRecordingMetadata } | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => {
      const value = request.result as { blob?: Blob; metadata?: LocalRecordingMetadata } | undefined;
      if (!value?.blob || !value.metadata) {
        resolve(null);
        return;
      }
      resolve({ blob: value.blob, metadata: value.metadata });
    };
    request.onerror = () => reject(request.error || new Error("Could not read local recording."));
  });
  database.close();
  return result;
}

export async function removeExpiredLocalRecordings() {
  const database = await openDatabase();
  const now = Date.now();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const expiresAt = cursor.value?.metadata?.expiresAt;
      if (expiresAt && new Date(expiresAt).getTime() <= now) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not clean local recordings."));
  });
  database.close();
}
