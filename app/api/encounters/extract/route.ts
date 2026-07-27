import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../lib/auth/api-request";
import { extractEncounterDraft } from "../../../../lib/encounter-extraction-server";

export async function POST(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  const personName = typeof body?.personName === "string" ? body.personName.trim() : "";

  if (transcript.length < 20) {
    return NextResponse.json({ error: "Add more transcript before generating context." }, { status: 400 });
  }

  try {
    const result = await extractEncounterDraft(transcript, personName);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not extract meeting context.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
