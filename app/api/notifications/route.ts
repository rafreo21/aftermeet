import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../lib/auth/api-request";
import { mapNotificationRow } from "../../../lib/notifications-server";

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ notifications: [], unreadCount: 0, preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "We couldn’t load your notifications." }, { status: 500 });
  }

  const notifications = (data ?? []).map(mapNotificationRow);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return NextResponse.json({ notifications, unreadCount }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const body = await request.json().catch(() => null) as { id?: unknown; markAllRead?: unknown } | null;
  if (user.id === "local-development-preview") {
    return NextResponse.json({ ok: true, preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
  const readAt = new Date().toISOString();

  if (body?.markAllRead === true) {
    const { error } = await supabase.from("notifications").update({ read_at: readAt }).is("read_at", null);
    if (error) return NextResponse.json({ error: "We couldn’t update your notifications." }, { status: 500 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (typeof body?.id === "string" && body.id.trim()) {
    const { error } = await supabase.from("notifications").update({ read_at: readAt }).eq("id", body.id.trim());
    if (error) return NextResponse.json({ error: "We couldn’t update this notification." }, { status: 500 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json({ error: "Specify a notification id or markAllRead." }, { status: 400 });
}
