import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
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
    return NextResponse.json({ error: "This card is unavailable right now." }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("cards")
    .select("id, slug, full_name, job_title, company, bio, card_methods(method_type, value, label, sort_order)")
    .eq("slug", normalized)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "This card is not published." }, { status: 404 });
  }

  const methods = [...(data.card_methods ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const email = methods.find((method) => method.method_type === "email")?.value ?? "";
  const phone = methods.find((method) => ["phone", "whatsapp"].includes(method.method_type))?.value ?? "";
  const linkedinUrl = methods.find((method) => method.method_type === "linkedin")?.value ?? "";

  return NextResponse.json({
    card: {
      id: data.id,
      slug: data.slug,
      fullName: data.full_name,
      role: data.job_title ?? "",
      company: data.company ?? "",
      bio: data.bio ?? "",
      email,
      phone,
      linkedinUrl,
    },
  }, { headers: { "Cache-Control": "public, max-age=60" } });
}
