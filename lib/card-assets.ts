import type { SupabaseClient } from "@supabase/supabase-js";

export const CARD_ASSETS_BUCKET = "card-assets";

export type CardAssetField = "photo" | "coverPhoto" | "companyLogo";

const FIELD_FILE_NAME: Record<CardAssetField, string> = {
  photo: "profile",
  coverPhoto: "cover",
  companyLogo: "logo",
};

export function isRemoteImageUrl(url: string) {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/api/");
}

export function needsCardImageUpload(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isRemoteImageUrl(trimmed)) return false;
  return trimmed.startsWith("data:") || trimmed.startsWith("file://") || trimmed.startsWith("content://");
}

export function publicCardImageUrl(url: string | null | undefined) {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return null;
  if (trimmed.startsWith("file://") || trimmed.startsWith("content://")) return null;
  return trimmed;
}

export function parseDataUrl(dataUrl: string) {
  const trimmed = dataUrl.trim();
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/is.exec(trimmed);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const payload = match[2] || "";
  const buffer = Buffer.from(payload, /;base64/i.test(trimmed) ? "base64" : "utf8");
  return { mimeType, buffer };
}

export function guessImageExtension(mimeType: string, fallback = "jpg") {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return fallback;
}

export function cardAssetStoragePath(
  workspaceId: string,
  cardId: string,
  field: CardAssetField,
  extension: string,
) {
  return `${workspaceId}/${cardId}/${FIELD_FILE_NAME[field]}.${extension}`;
}

export function cardAssetPublicUrl(supabase: SupabaseClient, storagePath: string) {
  const { data } = supabase.storage.from(CARD_ASSETS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function uploadCardAssetBuffer(
  service: SupabaseClient,
  workspaceId: string,
  cardId: string,
  field: CardAssetField,
  buffer: Buffer,
  mimeType: string,
) {
  const storagePath = cardAssetStoragePath(
    workspaceId,
    cardId,
    field,
    guessImageExtension(mimeType),
  );
  const upload = await service.storage
    .from(CARD_ASSETS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
  if (upload.error) throw new Error(upload.error.message || "Could not upload this image.");
  return cardAssetPublicUrl(service, storagePath);
}

export async function resolveCardImageForPublish(
  service: SupabaseClient,
  workspaceId: string,
  cardId: string,
  field: CardAssetField,
  currentUrl: string,
) {
  const trimmed = currentUrl.trim();
  if (!trimmed) return "";
  if (isRemoteImageUrl(trimmed)) return trimmed;
  if (trimmed.startsWith("data:")) {
    const parsed = parseDataUrl(trimmed);
    if (!parsed) return "";
    return uploadCardAssetBuffer(service, workspaceId, cardId, field, parsed.buffer, parsed.mimeType);
  }
  return "";
}
