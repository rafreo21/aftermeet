/** Cloud copies of shared recordings expire after this many days. */
export const CLOUD_RECORDING_RETENTION_DAYS = 3;

export type RecordingMetadataRecord = {
  durationSeconds?: number;
  fileSize?: number;
  mimeType?: string;
  source?: "recorded" | "imported";
  retention?: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  audioLocation?: "user_device" | "server" | "google_drive" | "onedrive";
  storagePath?: string;
  sharedAudioUrl?: string;
  cloudExpiresAt?: string | null;
  driveFileId?: string;
  driveWebViewUrl?: string;
  oneDriveItemId?: string;
  oneDriveWebUrl?: string;
  captureSession?: Record<string, unknown> | null;
};

export function cloudExpiresAt(from = new Date()): string {
  return new Date(
    from.getTime() + CLOUD_RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export function isCloudRecordingExpired(
  recording?: Pick<RecordingMetadataRecord, "cloudExpiresAt" | "expiresAt"> | null,
  now = Date.now(),
): boolean {
  const expiry = recording?.cloudExpiresAt ?? recording?.expiresAt;
  if (!expiry) return false;
  const time = new Date(expiry).getTime();
  return !Number.isNaN(time) && time <= now;
}

export function hasActiveCloudRecording(
  recording?: RecordingMetadataRecord | null,
  now = Date.now(),
): boolean {
  if (!recording?.storagePath?.trim()) return false;
  if (recording.audioLocation !== "server") return false;
  return !isCloudRecordingExpired(recording, now);
}

export function normalizeIncomingRecording(
  recording: Record<string, unknown> | null,
): RecordingMetadataRecord | null {
  if (!recording) return null;
  return {
    durationSeconds: typeof recording.durationSeconds === "number" ? recording.durationSeconds : 0,
    fileSize: typeof recording.fileSize === "number" ? recording.fileSize : 0,
    mimeType: typeof recording.mimeType === "string" ? recording.mimeType : "",
    source: recording.source === "imported" ? "imported" : "recorded",
    retention: typeof recording.retention === "string" ? recording.retention : "7_days",
    expiresAt: typeof recording.expiresAt === "string" ? recording.expiresAt : null,
    createdAt: typeof recording.createdAt === "string" ? recording.createdAt : null,
    audioLocation: recording.audioLocation === "server"
      ? "server"
      : recording.audioLocation === "google_drive"
        ? "google_drive"
        : recording.audioLocation === "onedrive" ? "onedrive" : "user_device",
    storagePath: typeof recording.storagePath === "string" ? recording.storagePath : undefined,
    sharedAudioUrl: typeof recording.sharedAudioUrl === "string" ? recording.sharedAudioUrl : undefined,
    cloudExpiresAt: typeof recording.cloudExpiresAt === "string" ? recording.cloudExpiresAt : null,
    driveFileId: typeof recording.driveFileId === "string" ? recording.driveFileId : undefined,
    driveWebViewUrl: typeof recording.driveWebViewUrl === "string" ? recording.driveWebViewUrl : undefined,
    oneDriveItemId: typeof recording.oneDriveItemId === "string" ? recording.oneDriveItemId : undefined,
    oneDriveWebUrl: typeof recording.oneDriveWebUrl === "string" ? recording.oneDriveWebUrl : undefined,
    captureSession: recording.captureSession && typeof recording.captureSession === "object"
      ? recording.captureSession as Record<string, unknown>
      : null,
  };
}

/** Preserve uploaded cloud metadata when mobile/web re-sync device-only fields. */
export function mergeRecordingMetadataForSave(
  incoming: Record<string, unknown> | null,
  existing: Record<string, unknown> | null,
): RecordingMetadataRecord | null {
  const next = normalizeIncomingRecording(incoming);
  const previous = normalizeIncomingRecording(existing);

  if (!next && !previous) return null;
  if (!next) return previous;
  if (!previous) return next;

  if (previous.audioLocation === "google_drive" && previous.driveFileId) {
    return {
      ...previous,
      ...next,
      audioLocation: "google_drive",
      driveFileId: previous.driveFileId,
      driveWebViewUrl: previous.driveWebViewUrl,
      cloudExpiresAt: null,
    };
  }

  if (previous.audioLocation === "onedrive" && previous.oneDriveItemId) {
    return {
      ...previous,
      ...next,
      audioLocation: "onedrive",
      oneDriveItemId: previous.oneDriveItemId,
      oneDriveWebUrl: previous.oneDriveWebUrl,
      cloudExpiresAt: null,
    };
  }

  // Expiry controls whether the cloud copy can be played, not whether its
  // persisted metadata should be discarded during an ordinary device sync.
  // The expiry/cleanup flow owns clearing these fields explicitly.
  const hasServerCopy = previous.audioLocation === "server" && Boolean(previous.storagePath?.trim());
  if (!hasServerCopy) {
    return { ...previous, ...next };
  }

  return {
    ...previous,
    ...next,
    audioLocation: "server",
    storagePath: previous.storagePath,
    sharedAudioUrl: previous.sharedAudioUrl ?? next.sharedAudioUrl,
    cloudExpiresAt: previous.cloudExpiresAt ?? next.cloudExpiresAt,
    fileSize: next.fileSize && next.fileSize > 0 ? next.fileSize : previous.fileSize,
    durationSeconds: next.durationSeconds ?? previous.durationSeconds,
    mimeType: next.mimeType || previous.mimeType,
  };
}

export function formatRecordingAvailableUntil(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
