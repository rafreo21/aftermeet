import { NextResponse } from "next/server";

import { createClient } from "../../../../../../lib/supabase/server";
import { createServiceSupabaseClient } from "../../../../../../lib/supabase/service";

function success(guestFollowUp: { committedAt: string; note: string }) {
  return NextResponse.json({ guestFollowUp }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "A share token is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 280) : "";
  if (note.length < 3) {
    return NextResponse.json({ error: "Add the next step you intend to take." }, { status: 400 });
  }
  const shareToken = token.trim();

  // Prefer the service client for this narrowly-scoped public write. This
  // keeps the guest action working even when the request has no auth cookie,
  // while still requiring a valid, currently shared encounter token.
  const service = createServiceSupabaseClient();
  if (service) {
    const { data: encounter } = await service
      .from("encounters")
      .select("id")
      .eq("share_token", shareToken)
      .eq("status", "shared")
      .maybeSingle();

    if (!encounter) {
      return NextResponse.json({ error: "This meeting record is no longer available." }, { status: 404 });
    }

    const committedAt = new Date().toISOString();
    const { error: insertError } = await service.from("encounter_guest_follow_ups").insert({
      encounter_id: encounter.id,
      note,
      committed_at: committedAt,
    });

    if (!insertError) return success({ committedAt, note });

    // Compatibility for projects that still have the earlier single-value
    // guest follow-up migration but not the multi-guest table migration.
    const guestFollowUp = { committedAt, note };
    const { error: legacyError } = await service
      .from("encounters")
      .update({ guest_follow_up: guestFollowUp })
      .eq("id", encounter.id);
    if (!legacyError) return success(guestFollowUp);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_guest_follow_up", {
    p_share_token: shareToken,
    p_note: note || null,
  });

  if (error || !data) {
    return NextResponse.json({ error: "Could not record your follow-up. Try again." }, { status: 404 });
  }

  return NextResponse.json({ guestFollowUp: data }, { headers: { "Cache-Control": "private, no-store" } });
}
