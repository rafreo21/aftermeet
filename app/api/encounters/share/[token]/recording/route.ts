import { NextResponse } from "next/server";

import { createClient } from "../../../../../../lib/supabase/server";
import { ENCOUNTER_RECORDINGS_BUCKET, createServiceSupabaseClient } from "../../../../../../lib/supabase/service";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "A share token is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_encounter", { p_share_token: token.trim() });
  if (error || !data) {
    return NextResponse.json({ error: "This meeting record is not available." }, { status: 404 });
  }

  const payload = data as Record<string, unknown>;
  const recording = payload.recording && typeof payload.recording === "object"
    ? payload.recording as Record<string, unknown>
    : null;
  const storagePath = typeof recording?.storagePath === "string" ? recording.storagePath : "";
  if (!storagePath) {
    return NextResponse.json({ error: "No shared recording is available for this meeting." }, { status: 404 });
  }

  const service = createServiceSupabaseClient();
  if (!service) {
    return NextResponse.json({ error: "Shared recording playback is not configured yet." }, { status: 503 });
  }

  const download = await service.storage.from(ENCOUNTER_RECORDINGS_BUCKET).download(storagePath);
  if (download.error || !download.data) {
    return NextResponse.json({ error: "Could not load this recording." }, { status: 404 });
  }

  const mimeType = typeof recording?.mimeType === "string" ? recording.mimeType : "audio/mp4";
  const buffer = Buffer.from(await download.data.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, no-store",
    },
  });
}
