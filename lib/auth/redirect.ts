const APP_ROOT = "/app";

const ALLOWED_PREFIXES = [
  APP_ROOT,
  "/onboarding",
  "/onboarding/visitor",
  "/c/",
  "/e/",
];

function isAllowedPath(pathname: string) {
  if (pathname === APP_ROOT) return true;
  return ALLOWED_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function sanitizeIntendedDestination(value: string | null | undefined): string {
  if (!value) return APP_ROOT;
  let candidate = value.trim();
  if (/[\u0000-\u001f\\]/.test(candidate)) return APP_ROOT;
  try {
    for (let index = 0; index < 2; index += 1) {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    }
  } catch {
    return APP_ROOT;
  }
  if (candidate.startsWith("//") || candidate.includes("://")) return APP_ROOT;
  try {
    const parsed = new URL(candidate, "https://aftermeet.local");
    if (parsed.origin !== "https://aftermeet.local") return APP_ROOT;
    if (!isAllowedPath(parsed.pathname)) return APP_ROOT;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return APP_ROOT;
  }
}
