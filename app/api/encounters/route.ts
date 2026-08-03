import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createApiSupabaseClient, resolveApiUser } from "../../../lib/auth/api-request";
import { encounterFromApi, normalizeEncounterActions, type EncounterParticipant } from "../../../lib/encounters";
import { fetchParticipantsByEncounter } from "../../../lib/encounter-participants-server";
import { fetchGuestFollowUpsByEncounter } from "../../../lib/encounter-guest-follow-ups-server";
import { encounterMatchesConnection } from "../../../lib/follow-ups-server";
import { mergeRecordingMetadataForSave } from "../../../lib/recording-metadata";
import { detectEncounterConflict } from "../../../lib/encounter-conflict";
import { createNotification, notificationTypeEnabled } from "../../../lib/notifications-server";
import { dispatchPushForUser } from "../../../lib/push-dispatch-server";

const allowedStatuses = new Set(["draft", "reviewed", "shared", "archived"]);

function parseIncomingParticipants(input: unknown): EncounterParticipant[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : crypto.randomUUID(),
        name: typeof record.name === "string" ? record.name.trim().slice(0, 160) : "",
        email: typeof record.email === "string" ? record.email.trim().slice(0, 320) : "",
        phone: typeof record.phone === "string" ? record.phone.trim().slice(0, 60) : "",
        linkedIn: typeof record.linkedIn === "string" ? record.linkedIn.trim().slice(0, 320) : "",
        exchangeId: typeof record.exchangeId === "string" && record.exchangeId.trim() ? record.exchangeId.trim() : undefined,
      } satisfies EncounterParticipant;
    })
    .filter((participant) => participant.name.length >= 2)
    .slice(0, 10);
}

function primaryProjection(participants: EncounterParticipant[]) {
  return {
    personName: participants.map((participant) => participant.name).join(", "),
    personEmail: participants.find((participant) => participant.email.includes("@"))?.email ?? "",
  };
}

async function syncEncounterParticipants(
  supabase: SupabaseClient,
  encounterId: string,
  workspaceId: string,
  participants: EncounterParticipant[],
) {
  await supabase.from("encounter_participants").delete().eq("encounter_id", encounterId);
  if (!participants.length) return;

  const rows = participants.map((participant, index) => ({
    id: participant.id,
    encounter_id: encounterId,
    workspace_id: workspaceId,
    display_name: participant.name,
    email: participant.email,
    phone: participant.phone,
    linkedin_url: participant.linkedIn,
    exchange_id: participant.exchangeId ?? null,
    is_primary: index === 0,
    sort_order: index,
  }));
  await supabase.from("encounter_participants").insert(rows);
}

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ encounters: [], preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const url = new URL(request.url);
  const contactId = url.searchParams.get("contactId")?.trim() || "";
  const sourceId = url.searchParams.get("sourceId")?.trim() || "";
  const exchangeId = url.searchParams.get("exchangeId")?.trim() || "";
  const email = url.searchParams.get("email")?.trim().toLowerCase() || "";

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .from("encounters")
    .select("*")
    .eq("workspace_id", user.workspaceId)
    .order("started_at", { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: "We couldn’t load your encounters." }, { status: 500 });
  }

  const encounterIds = (data ?? []).map((row) => row.id as string);
  const participantsByEncounter = await fetchParticipantsByEncounter(supabase, encounterIds);
  const guestFollowUpsByEncounter = await fetchGuestFollowUpsByEncounter(supabase, encounterIds);
  let encounters = (data ?? []).map((row) => encounterFromApi({
    ...row,
    participants: participantsByEncounter.get(row.id as string) ?? [],
    guest_follow_ups: guestFollowUpsByEncounter.get(row.id as string) ?? [],
  }));
  if (contactId || sourceId || exchangeId || email) {
    encounters = encounters.filter((encounter) => encounterMatchesConnection(encounter, {
      connectionId: contactId,
      sourceId,
      exchangeId,
      email,
    }));
  }

  return NextResponse.json({
    encounters,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string" || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "A valid encounter is required." }, { status: 400 });
  }

  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ ok: true, preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const recording = body.recording && typeof body.recording === "object"
    ? body.recording as Record<string, unknown>
    : null;

  const supabase = await createApiSupabaseClient(request);
  const { data: existingRow } = await supabase
    .from("encounters")
    .select("recording_metadata, updated_at")
    .eq("id", body.id)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  // Optimistic concurrency: a caller that knows the row it last read (via
  // expectedUpdatedAt) gets rejected if someone else has written to it
  // since, rather than silently overwriting their edit. Callers that don't
  // send it (the capture wizard's in-progress autosave, where one device
  // owns the draft) keep today's last-write-wins behavior unchanged.
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : "";
  if (detectEncounterConflict(existingRow?.updated_at, expectedUpdatedAt)) {
    return NextResponse.json({
      error: "This meeting changed on another device. Reload to see the latest version before saving your changes.",
      conflict: true,
      serverUpdatedAt: existingRow?.updated_at,
    }, { status: 409 });
  }

  const existingRecording = existingRow?.recording_metadata && typeof existingRow.recording_metadata === "object"
    ? existingRow.recording_metadata as Record<string, unknown>
    : null;

  const recordingMetadata = mergeRecordingMetadataForSave(recording, existingRecording);
  if (recordingMetadata?.captureSession && body.status !== "draft") {
    recordingMetadata.captureSession = null;
  }

  const participants = parseIncomingParticipants(body.participants);
  const projection = participants.length
    ? primaryProjection(participants)
    : {
        personName: typeof body.personName === "string" ? body.personName.trim() : "",
        personEmail: typeof body.personEmail === "string" ? body.personEmail.trim() : "",
      };
  const actions = normalizeEncounterActions(body.actions, participants, {
    name: projection.personName,
    email: projection.personEmail,
  });

  const nextUpdatedAt = new Date().toISOString();
  const { error } = await supabase.from("encounters").upsert({
    id: body.id,
    workspace_id: user.workspaceId,
    created_by_user_id: user.id,
    title: body.title.trim().slice(0, 160),
    person_name: projection.personName.slice(0, 160),
    person_email: projection.personEmail.slice(0, 320),
    contact_id: typeof body.contactId === "string" && body.contactId.trim() ? body.contactId.trim().slice(0, 120) : null,
    exchange_id: typeof body.exchangeId === "string" && body.exchangeId.trim() ? body.exchangeId.trim() : null,
    campaign_id: typeof body.campaignId === "string" && body.campaignId.trim() ? body.campaignId.trim().slice(0, 120) : null,
    started_at: body.startedAt,
    ended_at: body.endedAt,
    duration_seconds: typeof body.durationSeconds === "number" ? Math.max(0, Math.round(body.durationSeconds)) : 0,
    consent: body.consent,
    transcript: typeof body.transcript === "string" ? body.transcript : "",
    private_notes: typeof body.privateNotes === "string" ? body.privateNotes : "",
    shared_summary: typeof body.sharedSummary === "string" ? body.sharedSummary : "",
    actions,
    recording_metadata: recordingMetadata,
    status: typeof body.status === "string" && allowedStatuses.has(body.status) ? body.status : "draft",
    share_token: typeof body.shareToken === "string" ? body.shareToken : crypto.randomUUID().replaceAll("-", ""),
    updated_at: nextUpdatedAt,
  }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: "The encounter was saved on this device but could not sync." }, { status: 500 });
  }

  await syncEncounterParticipants(supabase, body.id, user.workspaceId, participants);

  // The encounter is reviewable — and its transcript actually has content —
  // the first time it is saved. This is the single place both mobile and
  // consumer web funnel through, so it is the one spot to raise
  // "review ready": one row per encounter, regardless of which client saved
  // it or how many times the save is retried (dedupe_key + unique index).
  const isNewEncounter = !existingRow;
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (isNewEncounter && (body.status ?? "draft") === "draft" && transcript.length >= 20) {
    try {
      const { data: preferenceRow } = await supabase
        .from("users")
        .select("notification_preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (notificationTypeEnabled(preferenceRow?.notification_preferences, "review_ready")) {
        const title = projection.personName.trim()
          ? `Ready to review: ${projection.personName.trim()}`
          : "A capture is ready to review";
        const notificationBody = "Your follow-up choices are saved. Confirm the review to activate them.";
        const created = await createNotification(supabase, {
          userId: user.id,
          workspaceId: user.workspaceId,
          type: "review_ready",
          title,
          body: notificationBody,
          encounterId: body.id,
          dedupeKey: `review_ready:${body.id}`,
        });
        if (created) {
          await dispatchPushForUser(supabase, {
            userId: user.id,
            type: "review_ready",
            title,
            body: notificationBody,
            encounterId: body.id,
          });
        }
      }
    } catch {
      // Best-effort: a missed notification must never fail the save itself.
    }
  }

  return NextResponse.json({ ok: true, updatedAt: nextUpdatedAt }, { headers: { "Cache-Control": "private, no-store" } });
}
