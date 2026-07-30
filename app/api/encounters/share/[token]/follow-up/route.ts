import { NextResponse } from "next/server";

import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "A share token is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 280) : "";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_guest_follow_up", {
    p_share_token: token.trim(),
    p_note: note || null,
  });

  if (error || !data) {
    return NextResponse.json({ error: "Could not record your follow-up. Try again." }, { status: 404 });
  }

  return NextResponse.json({ guestFollowUp: data }, { headers: { "Cache-Control": "private, no-store" } });
}
