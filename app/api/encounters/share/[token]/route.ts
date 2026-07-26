import { NextResponse } from "next/server";

import { encounterFromSharedPayload } from "../../../../../lib/encounters";
import { createClient } from "../../../../../lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "A share token is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_encounter", { p_share_token: token.trim() });

  if (error) {
    return NextResponse.json({ error: "This meeting record is not available." }, { status: 404 });
  }

  const encounter = encounterFromSharedPayload((data ?? {}) as Record<string, unknown>);
  if (!encounter) {
    return NextResponse.json({ error: "This meeting record is not available." }, { status: 404 });
  }

  return NextResponse.json({ encounter }, { headers: { "Cache-Control": "private, no-store" } });
}
