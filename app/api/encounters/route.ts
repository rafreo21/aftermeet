import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createApiSupabaseClient, resolveApiUser } from "../../../lib/auth/api-request";
import { encounterFromApi, type EncounterParticipant } from "../../../lib/encounters";
import { fetchParticipantsByEncounter } from "../../../lib/encounter-participants-server";
import { fetchGuestFollowUpsByEncounter } from "../../../lib/encounter-guest-follow-ups-server";
import { mergeRecordingMetadataForSave } from "../../../lib/recording-metadata";

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
    encounters = encounters.filter((encounter) => {
      if (contactId && encounter.contactId === contactId) return true;
      if (sourceId && encounter.contactId === sourceId) return true;
      if (exchangeId && encounter.exchangeId === exchangeId) return true;
      if (email && encounter.personEmail.trim().toLowerCase() === email) return true;
      return false;
    });
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
    .select("recording_metadata")
    .eq("id", body.id)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  const existingRecording = existingRow?.recording_metadata && typeof existingRow.recording_metadata === "object"
    ? existingRow.recording_metadata as Record<string, unknown>
    : null;

  const recordingMetadata = mergeRecordingMetadataForSave(recording, existingRecording);

  const participants = parseIncomingParticipants(body.participants);
  const projection = participants.length
    ? primaryProjection(participants)
    : {
        personName: typeof body.personName === "string" ? body.personName.trim() : "",
        personEmail: typeof body.personEmail === "string" ? body.personEmail.trim() : "",
      };

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
    actions: Array.isArray(body.actions) ? body.actions : [],
    recording_metadata: recordingMetadata,
    status: typeof body.status === "string" && allowedStatuses.has(body.status) ? body.status : "draft",
    share_token: typeof body.shareToken === "string" ? body.shareToken : crypto.randomUUID().replaceAll("-", ""),
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: "The encounter was saved on this device but could not sync." }, { status: 500 });
  }

  if (participants.length) {
    await syncEncounterParticipants(supabase, body.id, user.workspaceId, participants);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
