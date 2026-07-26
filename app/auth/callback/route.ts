import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  parseVisitorIntent,
  VISITOR_DEFAULT_DESTINATION,
  visitorOnboardingPath,
} from "../../../lib/auth/visitor-intent";
import { sanitizeIntendedDestination } from "../../../lib/auth/redirect";
import { requirePublicSupabaseConfig } from "../../../lib/supabase/env";

async function linkVisitorConnections(
  supabase: Awaited<ReturnType<typeof createClient>>,
  intent: ReturnType<typeof parseVisitorIntent>,
) {
  if (!intent) return;
  if (intent.exchangeId) {
    await supabase.rpc("link_people_connection_from_exchange", { p_exchange_id: intent.exchangeId });
  } else if (intent.slug) {
    await supabase.rpc("link_people_connection_from_scan", { p_slug: intent.slug });
  }
}

function createClient(request: NextRequest, response: NextResponse) {
  const config = requirePublicSupabaseConfig();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
}

export async function GET(request: NextRequest) {
  const intent = parseVisitorIntent(request.nextUrl.searchParams);
  const next = sanitizeIntendedDestination(request.nextUrl.searchParams.get("next"))
    || (intent ? VISITOR_DEFAULT_DESTINATION : "/app");
  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  const supabase = createClient(request, response);
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
  const onboardingStatus = (data as { onboarding_status?: string } | null)?.onboarding_status;
  if (onboardingStatus !== "completed") {
    const destination = intent ? visitorOnboardingPath(intent) : "/onboarding";
    return NextResponse.redirect(new URL(destination, request.url), { headers: response.headers });
  }
  if (intent) {
    await linkVisitorConnections(supabase, intent);
    return NextResponse.redirect(new URL(VISITOR_DEFAULT_DESTINATION, request.url), { headers: response.headers });
  }
  return response;
}
