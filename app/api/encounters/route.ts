import { NextResponse } from "next/server";

import { getAppUser } from "../../../lib/auth/context";
import { createClient } from "../../../lib/supabase/server";

const allowedStatuses = new Set(["draft", "reviewed", "shared", "archived"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string" || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "A valid encounter is required." }, { status: 400 });
  }

  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ ok: true, preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const recording = body.recording && typeof body.recording === "object"
    ? body.recording as Record<string, unknown>
    : null;
  const recordingMetadata = recording ? {
    durationSeconds: typeof recording.durationSeconds === "number" ? recording.durationSeconds : 0,
    fileSize: typeof recording.fileSize === "number" ? recording.fileSize : 0,
    mimeType: typeof recording.mimeType === "string" ? recording.mimeType : "",
    source: recording.source === "imported" ? "imported" : "recorded",
    retention: typeof recording.retention === "string" ? recording.retention : "7_days",
    expiresAt: typeof recording.expiresAt === "string" ? recording.expiresAt : null,
    createdAt: typeof recording.createdAt === "string" ? recording.createdAt : null,
    audioLocation: "user_device",
  } : null;

  const supabase = await createClient();
  const { error } = await supabase.from("encounters").upsert({
    id: body.id,
    workspace_id: user.workspaceId,
    created_by_user_id: user.id,
    title: body.title.trim().slice(0, 160),
    person_name: typeof body.personName === "string" ? body.personName.trim().slice(0, 160) : "",
    person_email: typeof body.personEmail === "string" ? body.personEmail.trim().slice(0, 320) : "",
    started_at: body.startedAt,
    ended_at: body.endedAt,
    duration_seconds: typeof body.durationSeconds === "number" ? Math.max(0, Math.round(body.durationSeconds)) : 0,
    consent: body.consent,
    transcript: typeof body.transcript === "string" ? body.transcript : "",
    private_notes: typeof body.privateNotes === "string" ? body.privateNotes : "",
    shared_summary: typeof body.sharedSummary === "string" ? body.sharedSummary : "",
    actions: Array.isArray(body.actions) ? body.actions : [],
    recording_metadata: recordingMetadata,
    status: typeof body.status === "string" && allowedStatuses.has(body.status) ? body.status : "draft",
    share_token: typeof body.shareToken === "string" ? body.shareToken : crypto.randomUUID().replaceAll("-", ""),
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: "The encounter was saved on this device but could not sync." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
