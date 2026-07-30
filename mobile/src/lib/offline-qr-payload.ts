import QRCode from 'qrcode';

import type { MobileCard } from '@/features/card/types';
import { publicCardImageUrl } from '@/lib/card-assets-client';
import { buildMobileContactQrPayload } from '@/lib/contact-qr-payload';
import { buildVcardPhotoThumbnail } from '@/lib/vcard-photo-thumbnail';

export type OfflineQrTier = 'photo' | 'full' | 'lean' | 'methods' | 'minimal';
export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export type OfflineQrPayload = {
  payload: string;
  tier: OfflineQrTier;
  ecl: QrErrorCorrection;
};

/**
 * Offline QR still shows the center logo, so never drop below 'Q': at 'L'/'M' the
 * logo's occlusion of the center modules can make the code unscannable. 'Q'/'H'
 * tolerate 25-30% damage, which is safe for a centered logo badge. This does cost
 * some capacity versus 'L' — the tier fallback below (full -> lean -> methods ->
 * minimal) absorbs that by shrinking content, same as it always has.
 */
const ECC_LEVELS: QrErrorCorrection[] = ['Q', 'H'];

function fitsInQr(payload: string, ecl: QrErrorCorrection) {
  try {
    QRCode.create(payload, { errorCorrectionLevel: ecl });
    return true;
  } catch {
    return false;
  }
}

function resolveEcl(payload: string): QrErrorCorrection {
  for (const ecl of ECC_LEVELS) {
    if (fitsInQr(payload, ecl)) return ecl;
  }
  return 'L';
}

/**
 * Pick the richest offline vCard that still fits in a scannable QR.
 * Never drop social/contact methods until the absolute last resort (minimal).
 */
export function buildOfflineQrPayload(card: MobileCard, cardUrl: string): OfflineQrPayload {
  const tiers: Array<{ tier: OfflineQrTier; build: () => string }> = [
    { tier: 'full', build: () => buildMobileContactQrPayload(card, cardUrl) },
    {
      tier: 'lean',
      build: () => buildMobileContactQrPayload(card, cardUrl, { omitBioCover: true }),
    },
    {
      tier: 'methods',
      build: () => buildMobileContactQrPayload(card, cardUrl, {
        omitBioCover: true,
        omitImages: true,
        lean: true,
      }),
    },
    {
      tier: 'minimal',
      build: () => buildMobileContactQrPayload(card, cardUrl, { minimal: true }),
    },
  ];

  for (const { tier, build } of tiers) {
    const payload = build();
    const ecl = resolveEcl(payload);
    if (fitsInQr(payload, ecl)) {
      return { payload, tier, ecl };
    }
  }

  const payload = buildMobileContactQrPayload(card, cardUrl, { minimal: true });
  return { payload, tier: 'minimal', ecl: resolveEcl(payload) };
}

/**
 * Best-effort enrichment: try embedding a tiny real thumbnail (instead of just a photo
 * URL) alongside every contact method. Returns null if there's no photo, the download/
 * resize fails, or the result doesn't fit — callers should fall back to `buildOfflineQrPayload`.
 */
export async function tryBuildOfflineQrPayloadWithPhoto(
  card: MobileCard,
  cardUrl: string,
): Promise<OfflineQrPayload | null> {
  const photoUrl = publicCardImageUrl(card.photo);
  if (!photoUrl) {
    if (__DEV__) console.warn('[offline-qr-payload] no photo URL on card, skipping embed tier');
    return null;
  }

  const embeddedPhoto = await buildVcardPhotoThumbnail(photoUrl);
  if (!embeddedPhoto) return null; // buildVcardPhotoThumbnail already logs its own failure

  const payload = buildMobileContactQrPayload(card, cardUrl, { embeddedPhoto });
  if (!fitsInQr(payload, 'L')) {
    if (__DEV__) {
      console.warn(`[offline-qr-payload] embedded-photo payload too large (${payload.length} bytes), falling back`);
    }
    return null;
  }

  return { payload, tier: 'photo', ecl: resolveEcl(payload) };
}
