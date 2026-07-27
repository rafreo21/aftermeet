import "server-only";

import { transcribe } from "ai";

import { isAiGatewayConfigured, refreshAiGatewayAuth } from "./ai-gateway-auth";
import { cleanLiveTranscript } from "./transcript-cleanup";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function transcriptionModel() {
  return process.env.AFTERMEET_TRANSCRIPTION_MODEL?.trim() || "openai/whisper-1";
}

export async function transcribeEncounterAudio(
  audio: Uint8Array,
  options?: { language?: string; mimeType?: string },
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

  if (!(await isAiGatewayConfigured())) {
    return {
      transcript: "",
      source: "unavailable",
      unavailable: "ai_not_configured",
    };
  }

  await refreshAiGatewayAuth();

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
