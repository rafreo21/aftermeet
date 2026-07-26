import { NextResponse } from "next/server";

import { requireAppUser } from "../../../../../lib/auth/context";
import { googleIntegrationConfigured, googleAuthorizeUrl } from "../../../../../lib/integrations/oauth";
import { createIntegrationState, setIntegrationStateCookie } from "../../_shared";

export async function GET(request: Request) {
  const user = await requireAppUser();
  if (user.id === "local-development-preview") {
    return NextResponse.redirect(new URL("/app/activate?integration=preview", request.url));
  }
  if (!googleIntegrationConfigured()) {
    return NextResponse.redirect(new URL("/app/activate?integration=google-unconfigured", request.url));
  }

  const state = createIntegrationState("google");
  const response = NextResponse.redirect(googleAuthorizeUrl(request.url, state));
  setIntegrationStateCookie(response, state);
  return response;
}
