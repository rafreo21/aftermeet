import { File, Paths } from 'expo-file-system';

import type { VcardEmbeddedImage } from '@/lib/vcard-images';

const THUMBNAIL_SIZE = 48;
const THUMBNAIL_COMPRESS = 0.4;

/**
 * Downloads and downscales a remote profile photo into a tiny embeddable vCard image,
 * so the offline QR can carry a real thumbnail instead of just a URL when there's
 * capacity left over after fitting every contact method (see offline-qr-payload.ts).
 * Returns null on any failure — callers fall back to the URL-only tiers.
 *
 * expo-image-manipulator is required lazily, inside the try/catch: a native module,
 * statically imported, executes its native-lookup at module-load time — before any
 * try/catch here could run — and crashes every screen that imports this file if the
 * installed native build doesn't have it yet (e.g. dev client not rebuilt). Requiring
 * it lazily keeps that failure contained to this best-effort enhancement.
 */
export async function buildVcardPhotoThumbnail(url: string): Promise<VcardEmbeddedImage | null> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');

    const downloaded = await File.downloadFileAsync(trimmed, Paths.cache, { idempotent: true });
    const rendered = await ImageManipulator.manipulate(downloaded.uri)
      .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE })
      .renderAsync();
    const result = await rendered.saveAsync({
      compress: THUMBNAIL_COMPRESS,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!result.base64) return null;
    return { base64: result.base64, mimeType: 'image/jpeg' };
  } catch (error) {
    if (__DEV__) {
      console.warn('[vcard-photo-thumbnail] embed failed, falling back to photo URL:', error);
    }
    return null;
  }
}
