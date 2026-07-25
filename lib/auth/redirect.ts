const APP_ROOT = "/app";

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
    if (parsed.pathname !== APP_ROOT && !parsed.pathname.startsWith(`${APP_ROOT}/`)) return APP_ROOT;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return APP_ROOT;
  }
}
