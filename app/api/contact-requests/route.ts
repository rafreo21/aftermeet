import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../lib/auth/api-request";

const allowedFieldPattern = /^[a-z_]+$/;

function isAllowedFieldType(fieldType: string) {
  return allowedFieldPattern.test(fieldType) && fieldType.length <= 40;
}

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ requests: [], preview: true });
  }

  const url = new URL(request.url);
  const targetEmail = url.searchParams.get("targetEmail")?.trim().toLowerCase() || user.email?.trim().toLowerCase() || "";
  if (!targetEmail) {
    return NextResponse.json({ requests: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .from("contact_field_requests")
    .select("id, field_type, channel, follow_up_title, status, created_at, requester_user_id")
    .eq("target_email", targetEmail)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Could not load contact requests." }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    targetEmail?: string;
    targetExchangeId?: string;
    fieldType?: string;
    channel?: string;
    followUpTitle?: string;
    encounterId?: string;
    actionId?: string;
  } | null;

  const targetEmail = body?.targetEmail?.trim().toLowerCase() || "";
  const fieldType = body?.fieldType?.trim() || "";
  const channel = body?.channel?.trim() || fieldType;

  if (!targetEmail || !isAllowedFieldType(fieldType)) {
    return NextResponse.json({ error: "A valid contact request is required." }, { status: 400 });
  }

  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ ok: true, preview: true });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .from("contact_field_requests")
    .insert({
      workspace_id: user.workspaceId,
      requester_user_id: user.id,
      target_email: targetEmail,
      target_exchange_id: body?.targetExchangeId?.trim() || null,
      field_type: fieldType,
      channel,
      follow_up_title: body?.followUpTitle?.trim() || "",
      encounter_id: body?.encounterId?.trim() || null,
      action_id: body?.actionId?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not send this request." }, { status: 500 });
  }

  // Push delivery will be wired when device tokens are available.
  return NextResponse.json({ ok: true, requestId: data.id }, { headers: { "Cache-Control": "private, no-store" } });
}
