import { createClient } from "@supabase/supabase-js";

import { contactMethodHref } from "@/lib/contact-methods";

type Params = Promise<{ slug: string }>;

function escapeVcard(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(_: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Response("Contact card unavailable.", { status: 503 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: card } = await supabase
    .from("cards")
    .select("*, card_methods(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!card) return new Response("Contact card not found.", { status: 404 });

  const methods = [...(card.card_methods || [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVcard(card.full_name)}`,
    card.job_title ? `TITLE:${escapeVcard(card.job_title)}` : "",
    card.company ? `ORG:${escapeVcard(card.company)}` : "",
    card.bio ? `NOTE:${escapeVcard(card.bio)}` : "",
    ...methods.flatMap((method) => {
      const value = escapeVcard(method.value);
      if (method.method_type === "email") return [`EMAIL;TYPE=INTERNET:${value}`];
      if (method.method_type === "phone") return [`TEL;TYPE=CELL:${value}`];
      if (method.method_type === "address") return [`ADR;TYPE=WORK:;;${value};;;;`];
      const href = contactMethodHref({ type: method.method_type, value: method.value });
      return href?.startsWith("http")
        ? [`URL;TYPE=${method.method_type.toUpperCase()}:${escapeVcard(href)}`]
        : [];
    }),
    "END:VCARD",
  ].filter(Boolean);

  const filename = card.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "aftermeet-contact";
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.vcf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
