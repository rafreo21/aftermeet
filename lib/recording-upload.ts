import type { LocalRecordingMetadata } from "./local-recordings";
import { audioFileExtension } from "./audio-format";

function guessFileName(mimeType: string, encounterId: string) {
  return `${encounterId}.${audioFileExtension(mimeType)}`;
}

export async function uploadEncounterRecording(
  encounterId: string,
  blob: Blob,
  mimeType = "audio/mp4",
): Promise<LocalRecordingMetadata> {
  const formData = new FormData();
  formData.append("audio", blob, guessFileName(mimeType, encounterId));

  const response = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/recording`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => ({})) as {
    ok?: boolean;
    error?: string;
    recording?: LocalRecordingMetadata;
  };

  if (!response.ok || !payload.ok || !payload.recording) {
    throw new Error(payload.error || "Could not upload this recording for sharing.");
  }

  return {
    id: encounterId,
    durationSeconds: payload.recording.durationSeconds ?? 0,
    fileSize: payload.recording.fileSize ?? blob.size,
    mimeType: payload.recording.mimeType || mimeType,
    source: payload.recording.source === "imported" ? "imported" : "recorded",
    retention: payload.recording.retention ?? "7_days",
    expiresAt: payload.recording.expiresAt ?? null,
    createdAt: payload.recording.createdAt ?? new Date().toISOString(),
    audioLocation: "server",
    storagePath: payload.recording.storagePath,
    sharedAudioUrl: payload.recording.sharedAudioUrl,
    cloudExpiresAt: payload.recording.cloudExpiresAt ?? null,
  };
}
