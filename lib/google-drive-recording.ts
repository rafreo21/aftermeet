import type { LocalRecordingMetadata } from "./local-recordings";
import { audioFileExtension } from "./audio-format";

export async function uploadRecordingToDrive(encounterId: string, audio: Blob, mimeType: string) {
  const form = new FormData();
  form.append("encounterId", encounterId);
  form.append("audio", audio, `${encounterId}.${audioFileExtension(mimeType)}`);
  const response = await fetch("/api/integrations/google/drive/recording", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({})) as { error?: string; recording?: LocalRecordingMetadata };
  if (!response.ok || !payload.recording) throw new Error(payload.error || "Could not save this recording to Google Drive.");
  return payload.recording;
}
