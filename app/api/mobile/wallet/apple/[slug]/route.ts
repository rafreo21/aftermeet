import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { buildAppleWalletPass } from "../../../../../../lib/apple-wallet-pack";
import { getAppUserFromRequest } from "../../../../../../lib/auth/mobile-api-auth";
import { readPublicSupabaseConfig } from "../../../../../../lib/supabase/env";
import { isAppleWalletConfigured, readAppleWalletCerts, type WalletCardPayload } from "../../../../../../lib/wallet-config";

function cardUrlForSlug(slug: string, request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = configured || new URL(request.url).origin;
  return `${origin.replace(/\/+$/, "")}/c/${slug}`;
}

async function loadWalletCard(slug: string, request: Request, workspaceId: string, accessToken: string) {
  const config = readPublicSupabaseConfig().config;
  if (!config) return null;
  const supabase = createSupabaseClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase
    .from("cards")
    .select("slug, full_name, job_title, company, bio, theme_color, status")
    .eq("slug", slug.toLowerCase())
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;

  return {
    slug: data.slug,
    fullName: data.full_name,
    role: data.job_title ?? "",
    company: data.company ?? "",
    bio: data.bio ?? "",
    themeColor: data.theme_color ?? "#9fe870",
    cardUrl: cardUrlForSlug(data.slug, request),
  } satisfies WalletCardPayload;
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const authHeader = request.headers.get("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const user = await getAppUserFromRequest(request);
  if (!user || !accessToken) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { slug } = await context.params;
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "A card slug is required." }, { status: 400 });
  }

  if (!isAppleWalletConfigured()) {
    return NextResponse.json({
      configured: false,
      error: "Apple Wallet signing is not configured for this environment.",
    }, { status: 503 });
  }

  const card = await loadWalletCard(normalized, request, user.workspaceId, accessToken);
  if (!card) {
    return NextResponse.json({ error: "Publish this card before creating a Wallet pass." }, { status: 404 });
  }

  try {
    const pass = await buildAppleWalletPass(card, readAppleWalletCerts()!);
    return new NextResponse(pass, {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${normalized}.pkpass"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "We couldn’t sign this Wallet pass.",
    }, { status: 500 });
  }
}
