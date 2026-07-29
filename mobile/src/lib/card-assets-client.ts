export type CardAssetField = "photo" | "coverPhoto" | "companyLogo";

export function isRemoteImageUrl(url: string) {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/api/");
}

export function publicCardImageUrl(url: string | null | undefined) {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return null;
  if (trimmed.startsWith("file://") || trimmed.startsWith("content://")) return null;
  return trimmed;
}

export function guessImageFileName(uri: string, field: CardAssetField) {
  const lower = uri.toLowerCase();
  if (lower.includes(".png")) return `${field}.png`;
  if (lower.includes(".webp")) return `${field}.webp`;
  if (lower.includes(".gif")) return `${field}.gif`;
  return `${field}.jpg`;
}

export function guessImageMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/jpeg";
}
