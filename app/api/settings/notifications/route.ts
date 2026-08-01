import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../lib/auth/api-request";

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ emailRemindersEnabled: true, preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase.rpc("get_my_reminder_preference");
  if (error) return NextResponse.json({ error: "We couldn’t load your reminder preferences." }, { status: 500 });
  return NextResponse.json({ emailRemindersEnabled: Boolean(data) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  const body = await request.json().catch(() => null) as { emailRemindersEnabled?: unknown } | null;
  if (typeof body?.emailRemindersEnabled !== "boolean") {
    return NextResponse.json({ error: "Choose whether email reminders are enabled." }, { status: 400 });
  }
  if (user.id === "local-development-preview") {
    return NextResponse.json({ emailRemindersEnabled: body.emailRemindersEnabled, preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase.rpc("set_reminder_email_preference", { p_enabled: body.emailRemindersEnabled });
  if (error) return NextResponse.json({ error: "We couldn’t update your reminder preferences." }, { status: 500 });
  return NextResponse.json({ emailRemindersEnabled: Boolean(data) }, { headers: { "Cache-Control": "private, no-store" } });
}
