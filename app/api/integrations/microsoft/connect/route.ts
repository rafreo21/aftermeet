import { NextResponse } from "next/server";

import {
  createIntegrationState,
  resolveIntegrationUser,
  sanitizeMobileReturnTo,
  setIntegrationFlowCookie,
  setIntegrationStateCookie,
} from "../../_shared";
import { microsoftAuthorizeUrl, microsoftIntegrationConfigured } from "../../../../../lib/integrations/oauth";

export async function GET(request: Request) {
  const returnTo = sanitizeMobileReturnTo(new URL(request.url).searchParams.get("return_to"));
  const user = await resolveIntegrationUser(request);

  if (!user) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }
  if (user.id === "local-development-preview") {
    return NextResponse.redirect(new URL("/business/activate?integration=preview", request.url));
  }
  if (!microsoftIntegrationConfigured()) {
    if (returnTo) {
      const { appendIntegrationParam } = await import("../../_shared");
      return NextResponse.redirect(appendIntegrationParam(returnTo, "microsoft-unconfigured"));
    }
    return NextResponse.redirect(new URL("/business/activate?integration=microsoft-unconfigured", request.url));
  }

  const state = createIntegrationState("microsoft");
  const response = NextResponse.redirect(microsoftAuthorizeUrl(request.url, state));
  setIntegrationStateCookie(response, state);
  if (returnTo) {
    setIntegrationFlowCookie(response, { state, user, returnTo });
  }
  return response;
}
