import { NextResponse } from "next/server";

import { isHubSpotConfigured } from "../../../../../lib/crm/hubspot";

export async function GET() {
  return NextResponse.json({
    configured: isHubSpotConfigured(),
    provider: "hubspot",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
