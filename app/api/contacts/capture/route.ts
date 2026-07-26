import { NextResponse } from "next/server";

import { getAppUser } from "../../../../lib/auth/context";
import { enrichCapturedProfile } from "../../../../lib/contact-capture-server";
import { isAiGatewayConfigured } from "../../../../lib/ai-gateway-auth";
import type { CapturedProfile } from "../../../../lib/page-profile-capture";

function isCapturedProfile(value: unknown): value is CapturedProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as CapturedProfile;
  return typeof candidate.firstName === "string" && typeof candidate.sourceUrl === "string";
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    profile?: CapturedProfile;
    pageText?: string;
  } | null;

  if (!body?.profile || !isCapturedProfile(body.profile)) {
    return NextResponse.json({ error: "A captured profile payload is required." }, { status: 400 });
  }

  if (!(await isAiGatewayConfigured())) {
    return NextResponse.json({
      profile: body.profile,
      source: "dom",
      uncertainFields: [],
      message: "Saved visible page details. Add AI_GATEWAY_API_KEY for smarter cleanup.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const enriched = await enrichCapturedProfile(body.profile, body.pageText ?? "");
    return NextResponse.json({
      profile: enriched.profile,
      source: "ai",
      uncertainFields: enriched.uncertainFields,
      message: "Cleaned captured profile details with AI.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({
      profile: body.profile,
      source: "dom",
      uncertainFields: [],
      message: "AI cleanup failed. Review the captured details before saving.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
