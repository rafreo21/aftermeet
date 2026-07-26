import "server-only";

export async function refreshAiGatewayAuth() {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return { configured: true, mode: "api_key" as const };
  }

  if (process.env.VERCEL_OIDC_TOKEN?.trim()) {
    return { configured: true, mode: "oidc_env" as const };
  }

  try {
    const { getVercelOidcToken } = await import("@vercel/oidc");
    const token = await getVercelOidcToken();
    if (token?.trim()) {
      process.env.VERCEL_OIDC_TOKEN = token.trim();
      return { configured: true, mode: "oidc_refresh" as const };
    }
  } catch {
    // Linked project or OIDC federation may be unavailable locally.
  }

  return { configured: false, mode: "none" as const };
}

export async function isAiGatewayConfigured() {
  const state = await refreshAiGatewayAuth();
  return state.configured;
}
