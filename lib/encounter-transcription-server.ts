import "server-only";

import { transcribe } from "ai";

import {
  groqTranscriptionConfig,
  isTranscriptionConfigured,
  prepareAiAuth,
  transcriptionModel,
  usesDirectOpenAi,
  usesGroqTranscription,
} from "./ai-provider";
import { cleanLiveTranscript } from "./transcript-cleanup";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function guessMimeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3") || lower.endsWith(".mpeg") || lower.endsWith(".mpga")) return "audio/mpeg";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  return "audio/mp4";
}

function resolveMimeAndName(options?: { mimeType?: string; fileName?: string }) {
  const fileName = options?.fileName?.trim() || "recording.m4a";
  const mimeType = options?.mimeType?.trim() || guessMimeFromFileName(fileName);
  return { fileName, mimeType };
}

/** Direct Whisper call with correct filename/MIME — AI SDK detectMediaType often mislabels m4a as wav. */
async function transcribeWithOpenAiWhisper(
  audio: Uint8Array,
  options: { language?: string; mimeType: string; fileName: string },
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from(audio)], { type: options.mimeType }),
    options.fileName,
  );
  form.append("model", "whisper-1");
  if (options.language) form.append("language", options.language);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const payload = await response.json().catch(() => null) as { text?: string; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI transcription failed (${response.status}).`);
  }
  return payload?.text?.trim() || "";
}

/** Groq hosts open-source Whisper behind an OpenAI-compatible endpoint — same multipart shape, free tier, no billing-account requirement. */
async function transcribeWithGroqWhisper(
  audio: Uint8Array,
  options: { language?: string; mimeType: string; fileName: string },
) {
  const { apiKey, model } = groqTranscriptionConfig();
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from(audio)], { type: options.mimeType }),
    options.fileName,
  );
  form.append("model", model);
  if (options.language) form.append("language", options.language);

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const payload = await response.json().catch(() => null) as { text?: string; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Groq transcription failed (${response.status}).`);
  }
  return payload?.text?.trim() || "";
}

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

  if (!(await isTranscriptionConfigured())) {
    throw new Error("Server transcription is not configured yet. Add OPENAI_API_KEY, or paste a transcript manually.");
  }

  await prepareAiAuth();

  const language = options?.language?.trim().slice(0, 12);
  const { fileName, mimeType } = resolveMimeAndName(options);

  try {
    const rawText = usesGroqTranscription()
      ? await transcribeWithGroqWhisper(audio, { language, mimeType, fileName })
      : usesDirectOpenAi()
        ? await transcribeWithOpenAiWhisper(audio, { language, mimeType, fileName })
        : (await transcribe({
            model: transcriptionModel(),
            audio,
            providerOptions: language ? { openai: { language } } : undefined,
          })).text.trim();

    const transcript = cleanLiveTranscript(rawText);
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
