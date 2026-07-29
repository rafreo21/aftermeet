import "server-only";

import { transcribe } from "ai";

import { isAiConfigured, prepareAiAuth, transcriptionModel } from "./ai-provider";
import { cleanLiveTranscript } from "./transcript-cleanup";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function transcribeEncounterAudio(
  audio: Uint8Array,
  options?: { language?: string; mimeType?: string; fileName?: string },
): Promise<{
  transcript: string;
  source: "ai" | "unavailable";
  unavailable?: string;
}> {
  if (audio.byteLength === 0) {
    throw new Error("Audio file is empty.");
  }

  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("Recording is larger than 25 MB. Choose a shorter or compressed recording.");
  }

  if (!(await isAiConfigured())) {
    throw new Error("Server transcription is not configured yet. Add OPENAI_API_KEY, or paste a transcript manually.");
  }

  await prepareAiAuth();

  const language = options?.language?.trim().slice(0, 12);

  try {
    const result = await transcribe({
      model: transcriptionModel(),
      audio,
      providerOptions: language ? { openai: { language } } : undefined,
    });

    const transcript = cleanLiveTranscript(result.text.trim());
    if (!transcript) {
      return {
        transcript: "",
        source: "unavailable",
        unavailable: "empty_transcript",
      };
    }

    return { transcript, source: "ai" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not transcribe this recording.";
    throw new Error(message);
  }
}
