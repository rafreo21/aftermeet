import { NextResponse } from "next/server";

import { resolveApiUser } from "../../../../../lib/auth/api-request";
import { provisionVisitorFromExchange } from "../../../../../lib/visitor-provision-server";
import { createServiceSupabaseClient } from "../../../../../lib/supabase/service";

export async function GET(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Lookup is unavailable right now." }, { status: 503 });
  }

  const { data: methodRows } = await supabase
    .from("card_methods")
    .select("cards!inner(slug, status)")
    .eq("method_type", "email")
    .eq("cards.status", "published")
    .ilike("value", email)
    .limit(1);

  const methodCard = methodRows?.[0]?.cards as { slug?: string } | { slug?: string }[] | undefined;
  const slugFromMethod = Array.isArray(methodCard) ? methodCard[0]?.slug : methodCard?.slug;
  if (slugFromMethod) {
    return NextResponse.json({ slug: slugFromMethod }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data: ownerRows } = await supabase
    .from("users")
    .select("id")
    .ilike("primary_email", email)
    .limit(1);

  const ownerId = ownerRows?.[0]?.id;
  if (ownerId) {
    const { data: membershipRows } = await supabase
      .from("workspace_memberships")
      .select("workspace_id")
      .eq("user_id", ownerId)
      .eq("status", "active")
      .limit(1);

    const workspaceId = membershipRows?.[0]?.workspace_id;
    if (workspaceId) {
      const { data: cardRows } = await supabase
        .from("cards")
        .select("slug")
        .eq("workspace_id", workspaceId)
        .eq("status", "published")
        .limit(1);

      const slugFromOwner = cardRows?.[0]?.slug;
      if (slugFromOwner) {
        return NextResponse.json({ slug: slugFromOwner }, { headers: { "Cache-Control": "private, no-store" } });
      }
    }
  }

  const { data: exchangeRow } = await supabase
    .from("card_exchanges")
    .select("id, visitor_name, visitor_email, visitor_phone, visitor_company, visitor_role, note")
    .ilike("visitor_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (exchangeRow?.visitor_name && exchangeRow.visitor_email) {
    const provisioned = await provisionVisitorFromExchange({
      email: exchangeRow.visitor_email,
      displayName: exchangeRow.visitor_name,
      exchangeId: exchangeRow.id,
      visitorCompany: exchangeRow.visitor_company || "",
      visitorRole: exchangeRow.visitor_role || "",
      visitorPhone: exchangeRow.visitor_phone || "",
      note: exchangeRow.note || "",
    });
    if (provisioned.ok && provisioned.slug) {
      return NextResponse.json({ slug: provisioned.slug }, { headers: { "Cache-Control": "private, no-store" } });
    }
  }

  return NextResponse.json({ slug: null }, { headers: { "Cache-Control": "private, no-store" } });
}
