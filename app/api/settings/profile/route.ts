import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../lib/auth/api-request";

type ProfileRow = {
  display_name: string | null;
  primary_email: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  email_verified: boolean | null;
};

function readProfile(row: ProfileRow | null) {
  return {
    displayName: row?.display_name ?? "",
    primaryEmail: row?.primary_email ?? "",
    phone: row?.phone ?? "",
    phoneVerified: Boolean(row?.phone_verified),
    emailVerified: Boolean(row?.email_verified),
  };
}

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json(readProfile({
      display_name: "Preview user",
      primary_email: "preview@aftermeet.local",
      phone: "",
      phone_verified: false,
      email_verified: true,
    }), { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase.rpc("get_my_app_context").single();
  if (error) return NextResponse.json({ error: "We couldn’t load your account." }, { status: 500 });

  return NextResponse.json(readProfile(data as ProfileRow | null), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  const body = await request.json().catch(() => null) as { displayName?: unknown; phone?: unknown } | null;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (displayName.length < 2) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }

  if (user.id === "local-development-preview") {
    return NextResponse.json({ displayName, phone, phoneVerified: false }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .rpc("update_my_account_profile", { p_display_name: displayName, p_phone: phone })
    .single();
  if (error) return NextResponse.json({ error: "We couldn’t save your account details." }, { status: 500 });

  const row = data as { display_name: string | null; phone: string | null; phone_verified: boolean | null } | null;
  if (!row) return NextResponse.json({ error: "We couldn’t save your account details." }, { status: 500 });

  return NextResponse.json({
    displayName: row.display_name ?? "",
    phone: row.phone ?? "",
    phoneVerified: Boolean(row.phone_verified),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
