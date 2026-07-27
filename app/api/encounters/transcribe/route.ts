import { NextResponse } from "next/server";

import { resolveApiUser } from "../../../../lib/auth/api-request";
import { transcribeEncounterAudio } from "../../../../lib/encounter-transcription-server";

function readFormValue(formData: globalThis.FormData, key: string) {
  for (const [name, value] of formData.entries()) {
    if (name === key) return value;
  }
  return null;
}

type JsonTranscribeBody = {
  audioBase64?: string;
  fileName?: string;
  mimeType?: string;
  lang?: string;
};

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
      const result = await transcribeEncounterAudio(buffer, {
        language: typeof body?.lang === "string" ? body.lang : undefined,
        mimeType: typeof body?.mimeType === "string" ? body.mimeType : undefined,
      });
      return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
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

  try {
    const buffer = new Uint8Array(await audio.arrayBuffer());
    const result = await transcribeEncounterAudio(buffer, {
      language,
      mimeType: audio.type,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not transcribe this recording.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
