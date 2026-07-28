export type VisitorIntent = {
  intent: "visitor";
  slug?: string;
  exchangeId?: string;
  shareToken?: string;
  email?: string;
};

export const VISITOR_DEFAULT_DESTINATION = "/app/people";

export function parseVisitorIntent(searchParams: URLSearchParams): VisitorIntent | null {
  if (searchParams.get("intent") !== "visitor") return null;
  return {
    intent: "visitor",
    slug: searchParams.get("slug")?.trim() || undefined,
    exchangeId: searchParams.get("exchangeId")?.trim() || undefined,
    shareToken: searchParams.get("shareToken")?.trim() || undefined,
    email: searchParams.get("email")?.trim().toLowerCase() || undefined,
  };
}

export function buildAuthHref(intent: VisitorIntent | { slug: string; exchangeId?: string; shareToken?: string; email?: string }) {
  const params = new URLSearchParams({
    intent: "visitor",
    next: VISITOR_DEFAULT_DESTINATION,
  });
  if (intent.slug) params.set("slug", intent.slug);
  if ("exchangeId" in intent && intent.exchangeId) params.set("exchangeId", intent.exchangeId);
  if ("shareToken" in intent && intent.shareToken) params.set("shareToken", intent.shareToken);
  if ("email" in intent && intent.email) params.set("email", intent.email.trim().toLowerCase());
  return `/auth?${params.toString()}`;
}

export function appendVisitorIntentToCallback(callback: URL, intent: VisitorIntent | null) {
  if (!intent) return;
  callback.searchParams.set("intent", intent.intent);
  if (intent.slug) callback.searchParams.set("slug", intent.slug);
  if (intent.exchangeId) callback.searchParams.set("exchangeId", intent.exchangeId);
  if (intent.shareToken) callback.searchParams.set("shareToken", intent.shareToken);
}

export function visitorOnboardingPath(intent: VisitorIntent | null) {
  const params = new URLSearchParams();
  if (intent?.slug) params.set("slug", intent.slug);
  if (intent?.exchangeId) params.set("exchangeId", intent.exchangeId);
  if (intent?.shareToken) params.set("shareToken", intent.shareToken);
  const query = params.toString();
  return query ? `/onboarding/visitor?${query}` : "/onboarding/visitor";
}
