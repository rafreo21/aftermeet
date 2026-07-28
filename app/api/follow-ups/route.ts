import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../lib/auth/api-request";
import { encounterFromApi } from "../../../lib/encounters";
import { flattenOpenFollowUps, sortFollowUps } from "../../../lib/follow-ups-server";

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ followUps: [], preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .from("encounters")
    .select("*")
    .eq("workspace_id", user.workspaceId)
    .order("started_at", { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: "We couldn’t load your follow-ups." }, { status: 500 });
  }

  const encounters = (data ?? []).map((row) => encounterFromApi(row));
  const followUps = sortFollowUps(flattenOpenFollowUps(encounters));

  return NextResponse.json({ followUps }, { headers: { "Cache-Control": "private, no-store" } });
}
