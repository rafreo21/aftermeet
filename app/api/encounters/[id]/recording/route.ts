import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../../lib/auth/api-request";
import { cloudExpiresAt } from "../../../../../lib/recording-metadata";
import { ENCOUNTER_RECORDINGS_BUCKET, createServiceSupabaseClient } from "../../../../../lib/supabase/service";
import { audioFileExtension, detectAudioMimeType } from "../../../../../lib/audio-format";
import { classifyRecordingUploadError } from "../../../../../lib/capture-errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "The recording upload could not be read. Your local copy is safe—retry from the meeting.", code: "recording_upload_failed", retryable: true }, { status: 400 });
  }
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size <= 0) {
    return NextResponse.json({ error: "No recording was received. Your local copy is safe—choose it again and retry.", code: "audio_missing", retryable: false }, { status: 400 });
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
    return NextResponse.json({ error: "Shared recording storage is not configured yet. Your local recording is safe.", code: "recording_storage_not_configured", retryable: false }, { status: 503 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = detectAudioMimeType(buffer, audio.type);
  const storagePath = `${user.workspaceId}/${id}.${audioFileExtension(mimeType)}`;
  const upload = await service.storage
    .from(ENCOUNTER_RECORDINGS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (upload.error) {
    const failure = classifyRecordingUploadError(upload.error);
    return NextResponse.json({ error: failure.error, code: failure.code, retryable: failure.retryable }, { status: failure.status });
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
    // Do not strand an untracked object when the database write fails. A
    // subsequent retry can then upload and finalize the recording cleanly.
    await service.storage.from(ENCOUNTER_RECORDINGS_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "The recording uploaded, but sharing could not be finalized. Your local copy is safe—retry from the meeting.", code: "recording_metadata_failed", retryable: true }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recording: recordingMetadata,
  });
}
