import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildBrandedQrPngBuffer } from "../../../../../lib/branded-qr.ts";
import { cardUrlForSlug } from "../../../../../lib/wallet-card-loader";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "A card slug is required." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Card lookup is not configured." }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("cards")
    .select("slug, status")
    .eq("slug", normalized)
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  const size = Math.min(Math.max(Number(new URL(request.url).searchParams.get("size") || 512), 256), 1024);
  const cardUrl = cardUrlForSlug(data.slug, request);
  const buffer = await buildBrandedQrPngBuffer(cardUrl, size);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
