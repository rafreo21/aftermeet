import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

export function createIntegrationState(provider: string) {
  return `${provider}:${randomBytes(16).toString("hex")}`;
}

export function readIntegrationState(request: NextRequest, provider: string) {
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const cookie = request.cookies.get("aftermeet-integration-state")?.value ?? "";
  return state && cookie === state && state.startsWith(`${provider}:`);
}

export function setIntegrationStateCookie(response: NextResponse, state: string) {
  response.cookies.set("aftermeet-integration-state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
}

export function clearIntegrationStateCookie(response: NextResponse) {
  response.cookies.set("aftermeet-integration-state", "", { path: "/", maxAge: 0 });
}
