import QRCode from 'qrcode';

import type { MobileCard } from '@/features/card/types';
import { buildMobileContactQrPayload } from '@/lib/contact-qr-payload';

export type OfflineQrTier = 'full' | 'lean' | 'methods' | 'minimal';
export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export type OfflineQrPayload = {
  payload: string;
  tier: OfflineQrTier;
  ecl: QrErrorCorrection;
};

/** Prefer lower ECC so full contact fields fit; logo is omitted on offline QR. */
const ECC_LEVELS: QrErrorCorrection[] = ['L', 'M', 'Q', 'H'];

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
