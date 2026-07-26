import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requirePublicSupabaseConfig } from "../../../lib/supabase/env";
import { sanitizeIntendedDestination } from "../../../lib/auth/redirect";

export async function GET(request: NextRequest) {
  const config = requirePublicSupabaseConfig();
  const next = sanitizeIntendedDestination(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError || !code) return NextResponse.redirect(new URL("/auth?error=callback", request.url));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/auth?error=callback", request.url));
  const { data, error: provisionError } = await supabase.rpc("provision_personal_workspace").single();
  if (provisionError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth?error=provisioning", request.url));
  }
  if ((data as { onboarding_status?: string } | null)?.onboarding_status !== "completed") {
    return NextResponse.redirect(new URL("/onboarding", request.url), { headers: response.headers });
  }
  return response;
}
