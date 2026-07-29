import { NextResponse } from "next/server";

import { isCloudRecordingExpired } from "../../../../lib/recording-metadata";
import { ENCOUNTER_RECORDINGS_BUCKET, createServiceSupabaseClient } from "../../../../lib/supabase/service";

type EncounterRow = {
  id: string;
  recording_metadata: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabaseClient();
  if (!service) {
    return NextResponse.json({ error: "Service client is not configured." }, { status: 503 });
  }

  const { data, error } = await service
    .from("encounters")
    .select("id, recording_metadata")
    .not("recording_metadata", "is", null)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "Could not scan encounter recordings." }, { status: 500 });
  }

  let expired = 0;
  let deleted = 0;
  const now = Date.now();

  for (const row of (data ?? []) as EncounterRow[]) {
    const metadata = row.recording_metadata;
    if (!metadata || typeof metadata !== "object") continue;

    const storagePath = typeof metadata.storagePath === "string" ? metadata.storagePath.trim() : "";
    if (!storagePath) continue;

    const cloudExpiresAt = typeof metadata.cloudExpiresAt === "string"
      ? metadata.cloudExpiresAt
      : typeof metadata.expiresAt === "string"
        ? metadata.expiresAt
        : null;

    if (!isCloudRecordingExpired({ cloudExpiresAt }, now)) continue;
    expired += 1;

    const removal = await service.storage.from(ENCOUNTER_RECORDINGS_BUCKET).remove([storagePath]);
    if (!removal.error) deleted += 1;

    const nextMetadata = {
      ...metadata,
      audioLocation: "user_device",
      storagePath: null,
      sharedAudioUrl: null,
      cloudExpiredAt: new Date(now).toISOString(),
    };

    await service
      .from("encounters")
      .update({ recording_metadata: nextMetadata })
      .eq("id", row.id);
  }

  return NextResponse.json({
    ok: true,
    scanned: data?.length ?? 0,
    expired,
    deleted,
  });
}
