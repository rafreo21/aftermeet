import { NextResponse } from "next/server";

import { getAppUser } from "../../../../lib/auth/context";
import { encounterFromApi } from "../../../../lib/encounters";
import { createClient } from "../../../../lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("encounters")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Encounter not found." }, { status: 404 });
  }

  return NextResponse.json({ encounter: encounterFromApi(data) }, { headers: { "Cache-Control": "private, no-store" } });
}
