import { NextResponse, type NextRequest } from "next/server";

import { requireAppUser } from "../../../../../lib/auth/context";
import { connectProviderFromCode } from "../../../../../lib/integrations/connected-accounts";
import { clearIntegrationStateCookie, readIntegrationState } from "../../_shared";

export async function GET(request: NextRequest) {
  const user = await requireAppUser();
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const response = NextResponse.redirect(new URL("/app/activate?integration=microsoft-connected", request.url));

  if (oauthError || !code || !readIntegrationState(request, "microsoft")) {
    clearIntegrationStateCookie(response);
    return NextResponse.redirect(new URL("/app/activate?integration=microsoft-error", request.url));
  }

  try {
    await connectProviderFromCode(user, "microsoft", request.url, code);
  } catch {
    clearIntegrationStateCookie(response);
    return NextResponse.redirect(new URL("/app/activate?integration=microsoft-error", request.url));
  }

  clearIntegrationStateCookie(response);
  return response;
}
