import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type CardAssetField, resolveCardImageForPublish } from "./card-assets";

export type CardImageFields = {
  photo: string;
  coverPhoto: string;
  companyLogo: string;
};

export async function resolveCardImagesForPublish(
  service: SupabaseClient,
  workspaceId: string,
  cardId: string,
  images: CardImageFields,
) {
  const [photo, coverPhoto, companyLogo] = await Promise.all([
    resolveCardImageForPublish(service, workspaceId, cardId, "photo", images.photo),
    resolveCardImageForPublish(service, workspaceId, cardId, "coverPhoto", images.coverPhoto),
    resolveCardImageForPublish(service, workspaceId, cardId, "companyLogo", images.companyLogo),
  ]);
  return { photo, coverPhoto, companyLogo };
}
