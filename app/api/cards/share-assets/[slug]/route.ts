import { NextResponse } from "next/server";

import {
  buildVirtualBackgroundJpeg,
  buildWatchFacePng,
  shareAssetFilename,
  shareAssetMimeType,
  type ShareAssetProfile,
} from "../../../../../lib/share-assets";
import { buildBrandedQrDataUri } from "../../../../../lib/branded-qr.ts";
import { getAppUser } from "../../../../../lib/auth/context";
import { createClient } from "../../../../../lib/supabase/server";
import { cardUrlForSlug } from "../../../../../lib/wallet-card-loader";

async function loadShareAssetProfile(slug: string, request: Request, workspaceId: string): Promise<ShareAssetProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .select("slug, full_name, job_title, company, theme_color, profile_image_url, company_logo_url, show_company_details, status")
    .eq("slug", slug.toLowerCase())
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;

  return {
    name: data.full_name,
    role: data.job_title ?? "",
    company: data.company ?? "",
    cardUrl: cardUrlForSlug(data.slug, request),
    themeColor: data.theme_color ?? "#9fe870",
    photoUrl: data.profile_image_url ?? "",
    companyLogoUrl: data.company_logo_url ?? "",
    showCompany: data.show_company_details ?? true,
  };
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const { slug } = await context.params;
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "A card slug is required." }, { status: 400 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type")?.trim().toLowerCase();
  if (type === "branded-qr") {
    const profile = await loadShareAssetProfile(normalized, request, user.workspaceId);
    if (!profile) {
      return NextResponse.json({ error: "Publish this card before downloading share assets." }, { status: 404 });
    }
    const size = Math.min(Math.max(Number(url.searchParams.get("size") || 512), 256), 1600);
    const dataUri = await buildBrandedQrDataUri(profile.cardUrl, size);
    return NextResponse.json({ dataUri });
  }

  if (type !== "virtual-background" && type !== "watch-face") {
    return NextResponse.json({
      error: "Pass type=virtual-background, type=watch-face, or type=branded-qr.",
    }, { status: 400 });
  }

  const profile = await loadShareAssetProfile(normalized, request, user.workspaceId);
  if (!profile) {
    return NextResponse.json({ error: "Publish this card before downloading share assets." }, { status: 404 });
  }

  const asset = type === "virtual-background"
    ? await buildVirtualBackgroundJpeg(profile)
    : await buildWatchFacePng(profile);
  const format = type === "virtual-background" ? "jpg" : "png";

  return new NextResponse(new Uint8Array(asset), {
    headers: {
      "Content-Type": shareAssetMimeType(type),
      "Content-Disposition": `attachment; filename="${shareAssetFilename(type, normalized, format)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
