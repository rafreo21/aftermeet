import {
  buildVirtualBackgroundJpeg,
  buildWatchFacePng,
  shareAssetFilename,
  shareAssetMimeType,
  type ShareAssetProfile,
} from "./share-assets";

export async function renderVirtualBackgroundOrWatchFace(
  type: "virtual-background" | "watch-face",
  profile: ShareAssetProfile,
  slug: string,
) {
  const asset = type === "virtual-background"
    ? await buildVirtualBackgroundJpeg(profile)
    : await buildWatchFacePng(profile);
  const format = type === "virtual-background" ? "jpg" : "png";

  return {
    body: new Uint8Array(asset),
    contentType: shareAssetMimeType(type),
    filename: shareAssetFilename(type, slug, format),
  };
}
