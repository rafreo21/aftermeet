import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const timeZone = typeof body?.timeZone === "string" ? body.timeZone.trim() : "";
  const locale = typeof body?.locale === "string" ? body.locale.trim() : "";
  if (displayName.length < 2 || displayName.length > 100 || timeZone.length > 80 || !localePattern.test(locale)) {
    return NextResponse.json({ error: "Check your name, time zone, and locale." }, { status: 400 });
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    return NextResponse.json({ error: "Enter a valid IANA time zone." }, { status: 400 });
  }
  const { error } = await supabase.rpc("complete_user_onboarding", {
    p_display_name: displayName,
    p_time_zone: timeZone,
    p_locale: locale,
  });
  if (error) return NextResponse.json({ error: "We couldn’t save your workspace." }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
