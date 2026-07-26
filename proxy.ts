import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicSupabaseConfig } from "./lib/supabase/env";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApp = pathname === "/app" || pathname.startsWith("/app/");
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  if (!isApp && !isOnboarding) return NextResponse.next();
  if (process.env.NODE_ENV === "development" && process.env.AFTERMEET_DEV_PREVIEW === "true") {
    return isOnboarding
      ? NextResponse.redirect(new URL("/app", request.url))
      : NextResponse.next();
  }

  const { config } = readPublicSupabaseConfig();
  if (!config) return NextResponse.redirect(new URL("/auth?error=configuration", request.url));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const next = `${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(new URL(`/auth?next=${encodeURIComponent(next)}`, request.url));
  }
  const { data: context } = await supabase.rpc("get_my_app_context").single();
  const status = (context as { onboarding_status?: string } | null)?.onboarding_status;
  if (isApp && status !== "completed") return NextResponse.redirect(new URL("/onboarding", request.url));
  if (isOnboarding && status === "completed") {
    return NextResponse.redirect(new URL(pathname.startsWith("/onboarding/visitor") ? "/app/people" : "/app", request.url));
  }
  return response;
}

export const config = { matcher: ["/app/:path*", "/onboarding", "/onboarding/:path*"] };
