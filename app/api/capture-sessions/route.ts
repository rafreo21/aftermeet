import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../lib/auth/api-request";
import {
  expireStaleCaptureSession,
  isCaptureSessionTransitionAllowed,
  normalizeCaptureSessionSnapshot,
} from "../../../lib/capture-session-snapshot";

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") return NextResponse.json({ sessions: [], preview: true });

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .from("encounters")
    .select("id, recording_metadata, updated_at")
    .eq("workspace_id", user.workspaceId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: "We couldn’t load active captures." }, { status: 500 });
  const sessions = (data ?? []).flatMap((row) => {
    const metadata = row.recording_metadata as Record<string, unknown> | null;
    const snapshot = metadata?.captureSession;
    const resolved = expireStaleCaptureSession(snapshot);
    return resolved ? [resolved] : [];
  });
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  const snapshot = normalizeCaptureSessionSnapshot(await request.json().catch(() => null));
  if (!snapshot) return NextResponse.json({ error: "A valid capture session is required." }, { status: 400 });
  if (user.id === "local-development-preview") return NextResponse.json({ ok: true, preview: true });

  const supabase = await createApiSupabaseClient(request);
  const { data: existing } = await supabase
    .from("encounters")
    .select("recording_metadata")
    .eq("id", snapshot.encounterId)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();
  const metadata = existing?.recording_metadata && typeof existing.recording_metadata === "object"
    ? existing.recording_metadata as Record<string, unknown>
    : {};
  const previousSession = metadata.captureSession && typeof metadata.captureSession === "object"
    ? metadata.captureSession as Record<string, unknown>
    : null;
  if (!isCaptureSessionTransitionAllowed(previousSession?.sessionStatus, snapshot.sessionStatus)) {
    return NextResponse.json({
      error: "This capture changed on another device. Reload it before continuing.",
      currentStatus: previousSession?.sessionStatus,
    }, { status: 409 });
  }
  const people = Array.isArray(snapshot.people) ? snapshot.people as Array<Record<string, unknown>> : [];
  const personName = people.map((person) => String(person.name ?? "").trim()).filter(Boolean).join(", ");
  const startedAt = typeof snapshot.recordingStartedAt === "string" && snapshot.recordingStartedAt
    ? snapshot.recordingStartedAt
    : new Date().toISOString();
  const { error } = await supabase.from("encounters").upsert({
    id: snapshot.encounterId,
    workspace_id: user.workspaceId,
    created_by_user_id: user.id,
    title: typeof snapshot.title === "string" && snapshot.title.trim() ? snapshot.title.trim().slice(0, 160) : "Capture in progress",
    person_name: personName.slice(0, 160),
    person_email: String(people.find((person) => String(person.email ?? "").includes("@"))?.email ?? "").slice(0, 320),
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    duration_seconds: snapshot.durationSeconds,
    consent: {
      confirmed: Boolean(snapshot.consent),
      method: snapshot.consentMethod === "written" ? "written" : "verbal",
      confirmedAt: Boolean(snapshot.consent) ? startedAt : "",
      scriptVersion: "2026-07-26",
    },
    transcript: typeof snapshot.transcript === "string" ? snapshot.transcript : "",
    private_notes: typeof snapshot.privateNotes === "string" ? snapshot.privateNotes : "",
    shared_summary: typeof snapshot.sharedSummary === "string" ? snapshot.sharedSummary : "",
    actions: [],
    recording_metadata: { ...metadata, captureSession: snapshot },
    status: "draft",
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: "This capture is safe on this device but could not sync." }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
