export type EncounterTranscriptionResult = {
  transcript: string;
  source: "ai" | "unavailable";
  unavailable?: string;
  error?: string;
};

export async function transcribeEncounterAudioBlob(
  blob: Blob,
  options?: { language?: string; fileName?: string },
): Promise<EncounterTranscriptionResult> {
  const formData = new FormData();
  const fileName = options?.fileName || guessAudioFileName(blob.type);
  formData.append("audio", blob, fileName);
  if (options?.language) formData.append("lang", options.language);

  const response = await fetch("/api/encounters/transcribe", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null) as EncounterTranscriptionResult | { error?: string } | null;
  if (!response.ok || !payload || !("source" in payload)) {
    return {
      transcript: "",
      source: "unavailable",
      error: payload && "error" in payload && payload.error ? payload.error : "Could not transcribe this recording.",
    };
  }

  return payload;
}

function guessAudioFileName(mimeType: string) {
  if (mimeType.includes("wav")) return "recording.wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "recording.mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "recording.m4a";
  if (mimeType.includes("ogg")) return "recording.ogg";
  if (mimeType.includes("webm")) return "recording.webm";
  return "recording.audio";
}
