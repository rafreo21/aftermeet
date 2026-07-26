import { NextResponse } from "next/server";

import { getAppUser } from "../../../../lib/auth/context";
import {
  enrichContactField,
  type EnrichmentField,
  type EnrichmentInput,
} from "../../../../lib/contact-enrichment";

function isEnrichmentField(value: unknown): value is EnrichmentField {
  return value === "email" || value === "phone";
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Partial<EnrichmentInput> | null;
  if (!body?.fullName?.trim() || !isEnrichmentField(body.field)) {
    return NextResponse.json({ error: "Full name and field (email or phone) are required." }, { status: 400 });
  }

  const result = await enrichContactField(
    {
      fullName: body.fullName,
      company: body.company ?? "",
      linkedinUrl: body.linkedinUrl,
      field: body.field,
      seedEmail: body.seedEmail,
      seedWorkEmail: body.seedWorkEmail,
      seedPersonalEmail: body.seedPersonalEmail,
      seedPhone: body.seedPhone,
    },
    { hunterApiKey: process.env.HUNTER_API_KEY?.trim() || undefined },
  );

  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
