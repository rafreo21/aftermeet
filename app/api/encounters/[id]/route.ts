import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../lib/auth/api-request";
import { encounterFromApi } from "../../../../lib/encounters";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
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

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error: lookupError } = await supabase
    .from("encounters")
    .select("id, recording_metadata")
    .eq("id", id)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  if (lookupError || !data) {
    return NextResponse.json({ error: "Encounter not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("encounters")
    .delete()
    .eq("id", id)
    .eq("workspace_id", user.workspaceId);

  if (error) {
    return NextResponse.json({ error: "Could not delete this capture." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
