import { NextResponse } from "next/server";

import { resolveApiUser } from "../../../../lib/auth/api-request";
import { createServiceSupabaseClient } from "../../../../lib/supabase/service";

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function POST(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") return NextResponse.json({ ok: true, preview: true });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const message = clean(body?.message, 1000);
  if (!message) return NextResponse.json({ error: "An error message is required." }, { status: 400 });

  const service = createServiceSupabaseClient();
  if (!service) return NextResponse.json({ ok: true, captured: false }, { status: 202 });

  const { error } = await service.from("client_error_reports").insert({
    workspace_id: user.workspaceId,
    user_id: user.id,
    surface: clean(body?.surface, 32) || "unknown",
    route: clean(body?.route, 256),
    message,
    stack: clean(body?.stack, 8000),
    component_stack: clean(body?.componentStack, 8000),
    app_version: clean(body?.appVersion, 64),
    platform: clean(body?.platform, 64),
  });

  if (error) return NextResponse.json({ ok: false, captured: false }, { status: 202 });
  return NextResponse.json({ ok: true, captured: true });
}
