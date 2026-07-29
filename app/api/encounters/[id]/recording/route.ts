import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../../lib/auth/api-request";
import { cloudExpiresAt } from "../../../../../lib/recording-metadata";
import { ENCOUNTER_RECORDINGS_BUCKET, createServiceSupabaseClient } from "../../../../../lib/supabase/service";

function guessExtension(mimeType: string) {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("aac")) return "aac";
  return "m4a";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size <= 0) {
    return NextResponse.json({ error: "An audio recording is required." }, { status: 400 });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .select("id, recording_metadata, share_token, status")
    .eq("id", id)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  if (encounterError || !encounter) {
    return NextResponse.json({ error: "Encounter not found." }, { status: 404 });
  }

  const service = createServiceSupabaseClient();
  if (!service) {
    return NextResponse.json({ error: "Shared recording storage is not configured yet." }, { status: 503 });
  }

  const mimeType = audio.type || "audio/mp4";
  const storagePath = `${user.workspaceId}/${id}.${guessExtension(mimeType)}`;
  const buffer = Buffer.from(await audio.arrayBuffer());
  const upload = await service.storage
    .from(ENCOUNTER_RECORDINGS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message || "Could not upload this recording." }, { status: 500 });
  }

  const previous = encounter.recording_metadata && typeof encounter.recording_metadata === "object"
    ? encounter.recording_metadata as Record<string, unknown>
    : {};

  const recordingMetadata = {
    ...previous,
    durationSeconds: typeof previous.durationSeconds === "number" ? previous.durationSeconds : 0,
    fileSize: audio.size,
    mimeType,
    source: previous.source === "imported" ? "imported" : "recorded",
    retention: typeof previous.retention === "string" ? previous.retention : "7_days",
    expiresAt: typeof previous.expiresAt === "string" ? previous.expiresAt : null,
    createdAt: typeof previous.createdAt === "string" ? previous.createdAt : new Date().toISOString(),
    audioLocation: "server",
    storagePath,
    sharedAudioUrl: `/api/encounters/share/${encounter.share_token}/recording`,
    cloudExpiresAt: cloudExpiresAt(new Date()),
  };

  const { error: updateError } = await supabase
    .from("encounters")
    .update({ recording_metadata: recordingMetadata })
    .eq("id", id)
    .eq("workspace_id", user.workspaceId);

  if (updateError) {
    return NextResponse.json({ error: "Recording uploaded but could not save metadata." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recording: recordingMetadata,
  });
}
