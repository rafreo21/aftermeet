import { NextResponse } from "next/server";

import {
  hasActiveCloudRecording,
  normalizeIncomingRecording,
} from "../../../../../../lib/recording-metadata";
import { ENCOUNTER_RECORDINGS_BUCKET, createServiceSupabaseClient } from "../../../../../../lib/supabase/service";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "A share token is required." }, { status: 400 });
  }

  const service = createServiceSupabaseClient();
  if (!service) {
    return NextResponse.json({ error: "Shared recording playback is not configured yet." }, { status: 503 });
  }

  const { data: encounter, error } = await service
    .from("encounters")
    .select("recording_metadata, status")
    .eq("share_token", token.trim())
    .eq("status", "shared")
    .maybeSingle();

  if (error || !encounter) {
    return NextResponse.json({ error: "This meeting record is not available." }, { status: 404 });
  }

  const recording = normalizeIncomingRecording(
    encounter.recording_metadata && typeof encounter.recording_metadata === "object"
      ? encounter.recording_metadata as Record<string, unknown>
      : null,
  );

  if (!hasActiveCloudRecording(recording)) {
    return NextResponse.json({ error: "This shared recording is no longer available." }, { status: 404 });
  }

  const storagePath = recording?.storagePath?.trim() ?? "";
  const download = await service.storage.from(ENCOUNTER_RECORDINGS_BUCKET).download(storagePath);
  if (download.error || !download.data) {
    return NextResponse.json({ error: "Could not load this recording." }, { status: 404 });
  }

  const mimeType = recording?.mimeType || "audio/mp4";
  const buffer = Buffer.from(await download.data.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="aftermeet-recording.${mimeType.includes("wav") ? "wav" : "m4a"}"`,
    },
  });
}
