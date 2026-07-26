import { NextResponse } from "next/server";

import { getAppUser } from "../../../../../../lib/auth/context";
import { buildGoogleWalletSaveUrl } from "../../../../../../lib/google-wallet-pass";
import { createClient } from "../../../../../../lib/supabase/server";
import { isGoogleWalletConfigured, readGoogleWalletConfig, type WalletCardPayload } from "../../../../../../lib/wallet-config";

function cardUrlForSlug(slug: string, request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = configured || new URL(request.url).origin;
  return `${origin.replace(/\/+$/, "")}/c/${slug}`;
}

async function loadWalletCard(slug: string, request: Request, workspaceId: string) {
  const supabase = await createClient();
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
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const { slug } = await context.params;
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "A card slug is required." }, { status: 400 });
  }

  if (!isGoogleWalletConfigured()) {
    return NextResponse.json({
      configured: false,
      error: "Google Wallet is not configured for this environment.",
      setup: ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON"],
    }, { status: 503 });
  }

  let card: WalletCardPayload | null = null;
  if (user.id === "local-development-preview") {
    card = {
      slug: normalized,
      fullName: "Preview User",
      role: "Consultant",
      company: "AfterMeet",
      bio: "Preview pass for local development.",
      themeColor: "#9fe870",
      cardUrl: cardUrlForSlug(normalized, request),
    };
  } else {
    card = await loadWalletCard(normalized, request, user.workspaceId);
  }

  if (!card) {
    return NextResponse.json({ error: "Publish this card before creating a Wallet pass." }, { status: 404 });
  }

  try {
    const saveUrl = buildGoogleWalletSaveUrl(card, readGoogleWalletConfig()!);
    return NextResponse.json({ configured: true, saveUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "We couldn’t create the Google Wallet save link.",
    }, { status: 500 });
  }
}
