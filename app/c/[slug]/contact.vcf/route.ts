import { createClient } from "@supabase/supabase-js";

import { buildCardVcard, fetchVcardImage } from "@/lib/vcard-export";
import { publicCardImageUrl } from "@/lib/card-assets";
import {
  filterMethodsForCompanyVisibility,
  publicCompanyField,
  publicCompanyLogoUrl,
} from "@/lib/card-company-display";

type Params = Promise<{ slug: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
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

  const cardUrl = new URL(`/c/${slug}`, request.url).toString();
  const showCompanyDetails = card.show_company_details ?? true;
  const methods = filterMethodsForCompanyVisibility(
    [...(card.card_methods || [])].sort((a, b) => a.sort_order - b.sort_order),
    showCompanyDetails,
  );
  const profilePhotoUrl = publicCardImageUrl(card.profile_image_url);
  const companyLogoUrl = publicCardImageUrl(publicCompanyLogoUrl(card.company_logo_url, showCompanyDetails));
  const coverPhotoUrl = publicCardImageUrl(card.cover_image_url);
  const [profilePhoto, companyLogoPhoto] = await Promise.all([
    profilePhotoUrl ? fetchVcardImage(profilePhotoUrl) : null,
    showCompanyDetails && companyLogoUrl ? fetchVcardImage(companyLogoUrl) : null,
  ]);
  const { body, filename } = buildCardVcard({
    fullName: card.full_name,
    jobTitle: card.job_title,
    company: publicCompanyField(card.company, showCompanyDetails),
    bio: card.bio,
    cardUrl,
    showCompanyDetails,
    profilePhoto,
    companyLogoPhoto,
    profilePhotoUrl,
    companyLogoUrl,
    coverPhotoUrl,
    methods: methods.map((method) => ({
      method_type: method.method_type,
      value: method.value,
      label: method.label,
    })),
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}.vcf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
