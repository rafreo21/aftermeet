import { NextResponse } from "next/server";

import { resolveApiUser } from "../../../../lib/auth/api-request";
import { transcribeEncounterAudio } from "../../../../lib/encounter-transcription-server";

export const maxDuration = 60;

function readFormValue(formData: FormData, key: string) {
  for (const [name, value] of formData.entries()) {
    if (name === key) return value;
  }
  return null;
}

function guessMimeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3") || lower.endsWith(".mpeg") || lower.endsWith(".mpga")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".3gp")) return "audio/3gpp";
  if (lower.endsWith(".amr")) return "audio/amr";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".opus")) return "audio/opus";
  return "";
}

type JsonTranscribeBody = {
  audioBase64?: string;
  fileName?: string;
  mimeType?: string;
  lang?: string;
};

async function runTranscription(
  buffer: Uint8Array,
  options: { language?: string; mimeType?: string; fileName?: string },
) {
  const mimeType = options.mimeType?.trim()
    || guessMimeFromFileName(options.fileName || "")
    || undefined;
  const result = await transcribeEncounterAudio(buffer, {
    language: options.language,
    mimeType,
    fileName: options.fileName,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as JsonTranscribeBody | null;
    const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64.trim() : "";
    if (!audioBase64) {
      return NextResponse.json({ error: "An audio recording is required." }, { status: 400 });
    }

    try {
      const buffer = new Uint8Array(Buffer.from(audioBase64, "base64"));
      return await runTranscription(buffer, {
        language: typeof body?.lang === "string" ? body.lang : undefined,
        mimeType: typeof body?.mimeType === "string" ? body.mimeType : undefined,
        fileName: typeof body?.fileName === "string" ? body.fileName : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not transcribe this recording.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const formData = await request.formData().catch(() => null);
  const audio = formData ? readFormValue(formData, "audio") : null;
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "An audio recording is required." }, { status: 400 });
  }

  const langValue = formData ? readFormValue(formData, "lang") : null;
  const language = typeof langValue === "string" ? langValue : undefined;
  const fileNameValue = formData ? readFormValue(formData, "fileName") : null;
  const fileName = typeof fileNameValue === "string" ? fileNameValue : undefined;
  const mimeValue = formData ? readFormValue(formData, "mimeType") : null;
  const mimeType = typeof mimeValue === "string"
    ? mimeValue
    : audio.type || guessMimeFromFileName(fileName || "recording.m4a");

  try {
    const buffer = new Uint8Array(await audio.arrayBuffer());
    return await runTranscription(buffer, { language, mimeType, fileName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not transcribe this recording.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
