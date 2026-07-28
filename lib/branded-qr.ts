import { readFile } from "node:fs/promises";
import { join } from "node:path";

import QRCode from "qrcode";
import sharp from "sharp";

import { AFTERMEET_LOGO_PNG_BASE64 } from "./aftermeet-logo-base64.ts";

const QR_OPTIONS = {
  errorCorrectionLevel: "H" as const,
  margin: 1,
  color: { dark: "#163300", light: "#FFFFFF" },
};

const EMBEDDED_LOGO_BUFFER = Buffer.from(AFTERMEET_LOGO_PNG_BASE64, "base64");

let logoBufferPromise: Promise<Buffer> | null = null;

async function loadAfterMeetLogoBuffer() {
  if (!logoBufferPromise) {
    logoBufferPromise = (async () => {
      const candidates = [
        join(process.cwd(), "public", "aftermeet-mark.png"),
        join(process.cwd(), "mobile", "assets", "images", "splash-icon.png"),
      ];
      for (const path of candidates) {
        try {
          const buffer = await readFile(path);
          if (buffer.length > 0) return buffer;
        } catch {
          // try next candidate
        }
      }
      return EMBEDDED_LOGO_BUFFER;
    })();
  }
  return logoBufferPromise;
}

export async function buildBrandedQrPngBuffer(cardUrl: string, size = 1024) {
  const [qrBuffer, logoBuffer] = await Promise.all([
    QRCode.toBuffer(cardUrl, {
      ...QR_OPTIONS,
      width: size,
    }),
    loadAfterMeetLogoBuffer(),
  ]);

  const logoSize = Math.round(size * 0.22);
  const badgePadding = Math.max(4, Math.round(size * 0.012));
  const badgeSize = logoSize + badgePadding * 2;
  const logoBadge = await sharp(logoBuffer)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .extend({
      top: badgePadding,
      bottom: badgePadding,
      left: badgePadding,
      right: badgePadding,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  const left = Math.round((size - badgeSize) / 2);
  const top = left;

  return sharp(qrBuffer)
    .composite([{ input: logoBadge, top, left }])
    .png()
    .toBuffer();
}

export async function buildBrandedQrDataUri(cardUrl: string, size = 1024) {
  const buffer = await buildBrandedQrPngBuffer(cardUrl, size);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function buildWalletLogoBuffers() {
  const logoBuffer = await loadAfterMeetLogoBuffer();
  const [icon, icon2x, logo, logo2x] = await Promise.all([
    sharp(logoBuffer).resize(29, 29, { fit: "contain", background: { r: 135, g: 234, b: 92, alpha: 1 } }).png().toBuffer(),
    sharp(logoBuffer).resize(58, 58, { fit: "contain", background: { r: 135, g: 234, b: 92, alpha: 1 } }).png().toBuffer(),
    sharp(logoBuffer).resize(160, 50, { fit: "contain", background: { r: 135, g: 234, b: 92, alpha: 0 } }).png().toBuffer(),
    sharp(logoBuffer).resize(320, 100, { fit: "contain", background: { r: 135, g: 234, b: 92, alpha: 0 } }).png().toBuffer(),
  ]);

  return {
    "icon.png": icon,
    "icon@2x.png": icon2x,
    "logo.png": logo,
    "logo@2x.png": logo2x,
  };
}
