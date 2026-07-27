import QRCode from "qrcode";
import sharp from "sharp";

import { buildBrandedQrDataUri, buildBrandedQrPngBuffer } from "./branded-qr.ts";

export type ShareAssetProfile = {
  name: string;
  role: string;
  company: string;
  cardUrl: string;
  themeColor?: string;
  photoUrl?: string;
  companyLogoUrl?: string;
  showCompany?: boolean;
};

const VIRTUAL_BG_WIDTH = 1920;
const VIRTUAL_BG_HEIGHT = 1080;
const VIRTUAL_PANEL_X = 1510;
const VIRTUAL_PANEL_Y = 48;
const VIRTUAL_PANEL_W = 380;
const VIRTUAL_PANEL_H = 320;
const VIRTUAL_PANEL_PAD = 28;
const VIRTUAL_QR_SIZE = 220;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeHex(hex: string | undefined, fallback = "#9FE870") {
  const trimmed = hex?.trim() || fallback;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function tint(hex: string, amount: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function virtualBackgroundLayout(profile: ShareAssetProfile) {
  const role = profile.role.trim();
  const company = profile.showCompany !== false ? profile.company.trim() : "";
  const subtitle = [role, company].filter(Boolean).join(" · ");
  const qrY = subtitle ? 156 : 132;
  const qrX = VIRTUAL_PANEL_X + Math.round((VIRTUAL_PANEL_W - VIRTUAL_QR_SIZE) / 2);
  const scanY = qrY + VIRTUAL_QR_SIZE + 34;
  const scanX = VIRTUAL_PANEL_X + Math.round(VIRTUAL_PANEL_W / 2);

  return { subtitle, qrX, qrY, scanX, scanY };
}

/** @deprecated Use buildBrandedQrDataUri instead. */
export async function buildQrPngDataUri(cardUrl: string, size = 512) {
  return buildBrandedQrDataUri(cardUrl, size);
}

export async function buildBrandedQrAsset(cardUrl: string, renderSize = 1024) {
  return buildBrandedQrDataUri(cardUrl, renderSize);
}

export async function buildVirtualBackgroundSvg(profile: ShareAssetProfile) {
  const theme = normalizeHex(profile.themeColor);
  const softTop = tint(theme, 0.55);
  const softBottom = tint(theme, 0.78);
  const name = escapeXml(profile.name.trim() || "Your name");
  const { subtitle, qrX, qrY, scanX, scanY } = virtualBackgroundLayout(profile);
  const qrDataUri = await buildBrandedQrDataUri(profile.cardUrl, VIRTUAL_QR_SIZE * 4);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_BG_WIDTH}" height="${VIRTUAL_BG_HEIGHT}" viewBox="0 0 ${VIRTUAL_BG_WIDTH} ${VIRTUAL_BG_HEIGHT}">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${softTop}"/>`,
    `<stop offset="100%" stop-color="${softBottom}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${VIRTUAL_BG_WIDTH}" height="${VIRTUAL_BG_HEIGHT}" fill="url(#bg)"/>`,
    `<rect x="${VIRTUAL_PANEL_X}" y="${VIRTUAL_PANEL_Y}" width="${VIRTUAL_PANEL_W}" height="${VIRTUAL_PANEL_H}" rx="24" fill="#FFFFFF" fill-opacity="0.96"/>`,
    `<text x="${VIRTUAL_PANEL_X + VIRTUAL_PANEL_PAD}" y="98" fill="#163300" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">${name}</text>`,
    subtitle
      ? `<text x="${VIRTUAL_PANEL_X + VIRTUAL_PANEL_PAD}" y="132" fill="#53634D" font-family="Arial, Helvetica, sans-serif" font-size="18">${escapeXml(subtitle)}</text>`
      : "",
    `<image href="${qrDataUri}" x="${qrX}" y="${qrY}" width="${VIRTUAL_QR_SIZE}" height="${VIRTUAL_QR_SIZE}" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="${scanX}" y="${scanY}" fill="#71806B" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle">Scan to save my contact</text>`,
    `</svg>`,
  ].filter(Boolean).join("");
}

/** JPG export for Zoom, Google Meet, Teams — meeting apps do not accept SVG backgrounds. */
export async function buildVirtualBackgroundJpeg(profile: ShareAssetProfile) {
  const theme = normalizeHex(profile.themeColor);
  const softTop = tint(theme, 0.55);
  const softBottom = tint(theme, 0.78);
  const name = escapeXml(profile.name.trim() || "Your name");
  const { subtitle, qrX, qrY, scanX, scanY } = virtualBackgroundLayout(profile);

  const backgroundSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_BG_WIDTH}" height="${VIRTUAL_BG_HEIGHT}">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${softTop}"/>`,
    `<stop offset="100%" stop-color="${softBottom}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${VIRTUAL_BG_WIDTH}" height="${VIRTUAL_BG_HEIGHT}" fill="url(#bg)"/>`,
    `</svg>`,
  ].join("");

  const panelSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_PANEL_W}" height="${VIRTUAL_PANEL_H}">`,
    `<rect width="${VIRTUAL_PANEL_W}" height="${VIRTUAL_PANEL_H}" rx="24" fill="#FFFFFF" fill-opacity="0.96"/>`,
    `</svg>`,
  ].join("");

  const textSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_BG_WIDTH}" height="${VIRTUAL_BG_HEIGHT}">`,
    `<text x="${VIRTUAL_PANEL_X + VIRTUAL_PANEL_PAD}" y="98" fill="#163300" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">${name}</text>`,
    subtitle
      ? `<text x="${VIRTUAL_PANEL_X + VIRTUAL_PANEL_PAD}" y="132" fill="#53634D" font-family="Arial, Helvetica, sans-serif" font-size="18">${escapeXml(subtitle)}</text>`
      : "",
    `<text x="${scanX}" y="${scanY}" fill="#71806B" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle">Scan to save my contact</text>`,
    `</svg>`,
  ].filter(Boolean).join("");

  const [background, panel, qrBuffer, textLayer] = await Promise.all([
    sharp(Buffer.from(backgroundSvg)).png().toBuffer(),
    sharp(Buffer.from(panelSvg)).png().toBuffer(),
    buildBrandedQrPngBuffer(profile.cardUrl, VIRTUAL_QR_SIZE * 4).then((buffer) =>
      sharp(buffer).resize(VIRTUAL_QR_SIZE, VIRTUAL_QR_SIZE).png().toBuffer(),
    ),
    sharp(Buffer.from(textSvg)).png().toBuffer(),
  ]);

  return sharp(background)
    .composite([
      { input: panel, top: VIRTUAL_PANEL_Y, left: VIRTUAL_PANEL_X },
      { input: qrBuffer, top: qrY, left: qrX },
      { input: textLayer, top: 0, left: 0 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export async function buildWatchFacePng(profile: ShareAssetProfile) {
  const name = escapeXml(profile.name.trim() || "My card");
  const size = 400;
  const qrDisplaySize = 240;
  const qrX = Math.round((size - qrDisplaySize) / 2);
  const qrY = 92;

  const backgroundSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`,
    `<rect width="${size}" height="${size}" rx="56" fill="#050505"/>`,
    `</svg>`,
  ].join("");

  const frameSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${qrDisplaySize + 16}" height="${qrDisplaySize + 16}">`,
    `<rect width="${qrDisplaySize + 16}" height="${qrDisplaySize + 16}" rx="22" fill="#FFFFFF"/>`,
    `</svg>`,
  ].join("");

  const textSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`,
    `<text x="200" y="54" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle">Personal card</text>`,
    `<text x="200" y="372" fill="#D7D7D7" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle">${name}</text>`,
    `</svg>`,
  ].join("");

  const [background, frame, qrBuffer, textLayer] = await Promise.all([
    sharp(Buffer.from(backgroundSvg)).png().toBuffer(),
    sharp(Buffer.from(frameSvg)).png().toBuffer(),
    buildBrandedQrPngBuffer(profile.cardUrl, qrDisplaySize * 4).then((buffer) =>
      sharp(buffer).resize(qrDisplaySize, qrDisplaySize).png().toBuffer(),
    ),
    sharp(Buffer.from(textSvg)).png().toBuffer(),
  ]);

  return sharp(background)
    .composite([
      { input: frame, top: qrY - 8, left: qrX - 8 },
      { input: qrBuffer, top: qrY, left: qrX },
      { input: textLayer, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function buildWatchFaceSvg(profile: ShareAssetProfile) {
  const name = escapeXml(profile.name.trim() || "My card");
  const qrRenderSize = 960;
  const qrDisplaySize = 240;
  const qrX = Math.round((400 - qrDisplaySize) / 2);
  const qrY = 92;
  const qrDataUri = await buildBrandedQrDataUri(profile.cardUrl, qrRenderSize);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">`,
    `<rect width="400" height="400" rx="56" fill="#050505"/>`,
    `<text x="200" y="54" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle">Personal card</text>`,
    `<rect x="${qrX - 8}" y="${qrY - 8}" width="${qrDisplaySize + 16}" height="${qrDisplaySize + 16}" rx="22" fill="#FFFFFF"/>`,
    `<image href="${qrDataUri}" x="${qrX}" y="${qrY}" width="${qrDisplaySize}" height="${qrDisplaySize}" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="200" y="372" fill="#D7D7D7" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle">${name}</text>`,
    `</svg>`,
  ].join("");
}

export function shareAssetFilename(
  type: "virtual-background" | "watch-face",
  slug: string,
  format: "jpg" | "jpeg" | "png" | "svg" = type === "virtual-background" ? "jpg" : "png",
) {
  const normalizedFormat = format === "jpeg" ? "jpg" : format;
  return `aftermeet-${type}-${slug}.${normalizedFormat}`;
}

export function shareAssetMimeType(type: "virtual-background" | "watch-face") {
  return type === "virtual-background" ? "image/jpeg" : "image/png";
}
