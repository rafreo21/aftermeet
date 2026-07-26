import { NextResponse } from "next/server";

import { requireAppUser } from "../../../../../lib/auth/context";
import { microsoftIntegrationConfigured, microsoftAuthorizeUrl } from "../../../../../lib/integrations/oauth";
import { createIntegrationState, setIntegrationStateCookie } from "../../_shared";

export async function GET(request: Request) {
  const user = await requireAppUser();
  if (user.id === "local-development-preview") {
    return NextResponse.redirect(new URL("/app/activate?integration=preview", request.url));
  }
  if (!microsoftIntegrationConfigured()) {
    return NextResponse.redirect(new URL("/app/activate?integration=microsoft-unconfigured", request.url));
  }

  const state = createIntegrationState("microsoft");
  const response = NextResponse.redirect(microsoftAuthorizeUrl(request.url, state));
  setIntegrationStateCookie(response, state);
  return response;
}
