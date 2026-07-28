import sharp from "sharp";

import { buildBrandedQrDataUri, buildBrandedQrPngBuffer } from "./branded-qr.ts";
import { loadShareAssetFontsBase64, shareAssetFontStyles } from "./share-asset-fonts.ts";
import {
  buildVirtualBackgroundLayout,
  VIRTUAL_BG_PANEL,
} from "./virtual-background-layout.ts";

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

/** @deprecated Use buildBrandedQrDataUri instead. */
export async function buildQrPngDataUri(cardUrl: string, size = 512) {
  return buildBrandedQrDataUri(cardUrl, size);
}

export async function buildBrandedQrAsset(cardUrl: string, renderSize = 1024) {
  return buildBrandedQrDataUri(cardUrl, renderSize);
}

async function buildVirtualBackgroundSvgDocument(profile: ShareAssetProfile) {
  const theme = normalizeHex(profile.themeColor);
  const softTop = tint(theme, 0.55);
  const softBottom = tint(theme, 0.78);
  const name = escapeXml(profile.name.trim() || "Your name");
  const layout = buildVirtualBackgroundLayout(profile);
  const fonts = await loadShareAssetFontsBase64();
  const qrRenderSize = VIRTUAL_BG_PANEL.qrSize * 5;
  const qrDataUri = await buildBrandedQrDataUri(profile.cardUrl, qrRenderSize);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_BG_PANEL.canvasWidth}" height="${VIRTUAL_BG_PANEL.canvasHeight}" viewBox="0 0 ${VIRTUAL_BG_PANEL.canvasWidth} ${VIRTUAL_BG_PANEL.canvasHeight}">`,
    `<defs>`,
    `<style>${shareAssetFontStyles(fonts.regular, fonts.bold)}</style>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${softTop}"/>`,
    `<stop offset="100%" stop-color="${softBottom}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${VIRTUAL_BG_PANEL.canvasWidth}" height="${VIRTUAL_BG_PANEL.canvasHeight}" fill="url(#bg)"/>`,
    `<rect x="${VIRTUAL_BG_PANEL.x}" y="${VIRTUAL_BG_PANEL.y}" width="${VIRTUAL_BG_PANEL.width}" height="${VIRTUAL_BG_PANEL.height}" rx="${VIRTUAL_BG_PANEL.radius}" fill="#FFFFFF" fill-opacity="0.94"/>`,
    `<text x="${layout.nameX}" y="${layout.nameY}" fill="#163300" font-family="Inter, Arial, sans-serif" font-size="${VIRTUAL_BG_PANEL.nameFontSize}" font-weight="700">${name}</text>`,
    layout.subtitle
      ? `<text x="${layout.nameX}" y="${layout.subtitleY}" fill="#53634D" font-family="Inter, Arial, sans-serif" font-size="${VIRTUAL_BG_PANEL.subtitleFontSize}" font-weight="400">${escapeXml(layout.subtitle)}</text>`
      : "",
    `<rect x="${layout.qrX - 4}" y="${layout.qrY - 4}" width="${VIRTUAL_BG_PANEL.qrSize + 8}" height="${VIRTUAL_BG_PANEL.qrSize + 8}" rx="12" fill="#FFFFFF"/>`,
    `<image href="${qrDataUri}" x="${layout.qrX}" y="${layout.qrY}" width="${VIRTUAL_BG_PANEL.qrSize}" height="${VIRTUAL_BG_PANEL.qrSize}" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="${layout.scanX}" y="${layout.scanY}" fill="#71806B" font-family="Inter, Arial, sans-serif" font-size="${VIRTUAL_BG_PANEL.scanFontSize}" font-weight="400">Scan to save my contact</text>`,
    `</svg>`,
  ].filter(Boolean).join("");
}

export async function buildVirtualBackgroundSvg(profile: ShareAssetProfile) {
  return buildVirtualBackgroundSvgDocument(profile);
}

/** JPG export for Zoom, Google Meet, and Teams. */
export async function buildVirtualBackgroundJpeg(profile: ShareAssetProfile) {
  const theme = normalizeHex(profile.themeColor);
  const softTop = tint(theme, 0.55);
  const softBottom = tint(theme, 0.78);
  const name = escapeXml(profile.name.trim() || "Your name");
  const layout = buildVirtualBackgroundLayout(profile);
  const fonts = await loadShareAssetFontsBase64();

  const backgroundSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_BG_PANEL.canvasWidth}" height="${VIRTUAL_BG_PANEL.canvasHeight}">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${softTop}"/>`,
    `<stop offset="100%" stop-color="${softBottom}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${VIRTUAL_BG_PANEL.canvasWidth}" height="${VIRTUAL_BG_PANEL.canvasHeight}" fill="url(#bg)"/>`,
    `</svg>`,
  ].join("");

  const panelSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_BG_PANEL.width}" height="${VIRTUAL_BG_PANEL.height}">`,
    `<rect width="${VIRTUAL_BG_PANEL.width}" height="${VIRTUAL_BG_PANEL.height}" rx="${VIRTUAL_BG_PANEL.radius}" fill="#FFFFFF" fill-opacity="0.94"/>`,
    `</svg>`,
  ].join("");

  const textSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIRTUAL_BG_PANEL.canvasWidth}" height="${VIRTUAL_BG_PANEL.canvasHeight}">`,
    `<style>${shareAssetFontStyles(fonts.regular, fonts.bold)}</style>`,
    `<text x="${layout.nameX}" y="${layout.nameY}" fill="#163300" font-family="Inter, Arial, sans-serif" font-size="${VIRTUAL_BG_PANEL.nameFontSize}" font-weight="700">${name}</text>`,
    layout.subtitle
      ? `<text x="${layout.nameX}" y="${layout.subtitleY}" fill="#53634D" font-family="Inter, Arial, sans-serif" font-size="${VIRTUAL_BG_PANEL.subtitleFontSize}" font-weight="400">${escapeXml(layout.subtitle)}</text>`
      : "",
    `<text x="${layout.scanX}" y="${layout.scanY}" fill="#71806B" font-family="Inter, Arial, sans-serif" font-size="${VIRTUAL_BG_PANEL.scanFontSize}" font-weight="400">Scan to save my contact</text>`,
    `</svg>`,
  ].filter(Boolean).join("");

  const [background, panel, qrBuffer, textLayer] = await Promise.all([
    sharp(Buffer.from(backgroundSvg)).png().toBuffer(),
    sharp(Buffer.from(panelSvg)).png().toBuffer(),
    buildBrandedQrPngBuffer(profile.cardUrl, VIRTUAL_BG_PANEL.qrSize * 5).then((buffer) =>
      sharp(buffer).resize(VIRTUAL_BG_PANEL.qrSize, VIRTUAL_BG_PANEL.qrSize, { kernel: sharp.kernel.nearest }).png().toBuffer(),
    ),
    sharp(Buffer.from(textSvg)).png().toBuffer(),
  ]);

  return sharp(background)
    .composite([
      { input: panel, top: VIRTUAL_BG_PANEL.y, left: VIRTUAL_BG_PANEL.x },
      { input: qrBuffer, top: layout.qrY, left: layout.qrX },
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
  const fonts = await loadShareAssetFontsBase64();

  const backgroundSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`,
    `<style>${shareAssetFontStyles(fonts.regular, fonts.bold)}</style>`,
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
    `<style>${shareAssetFontStyles(fonts.regular, fonts.bold)}</style>`,
    `<text x="200" y="54" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="400" text-anchor="middle">Personal card</text>`,
    `<text x="200" y="372" fill="#D7D7D7" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="400" text-anchor="middle">${name}</text>`,
    `</svg>`,
  ].join("");

  const [background, frame, qrBuffer, textLayer] = await Promise.all([
    sharp(Buffer.from(backgroundSvg)).png().toBuffer(),
    sharp(Buffer.from(frameSvg)).png().toBuffer(),
    buildBrandedQrPngBuffer(profile.cardUrl, qrDisplaySize * 4).then((buffer) =>
      sharp(buffer).resize(qrDisplaySize, qrDisplaySize, { kernel: sharp.kernel.nearest }).png().toBuffer(),
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
  const fonts = await loadShareAssetFontsBase64();
  const qrDataUri = await buildBrandedQrDataUri(profile.cardUrl, qrRenderSize);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">`,
    `<style>${shareAssetFontStyles(fonts.regular, fonts.bold)}</style>`,
    `<rect width="400" height="400" rx="56" fill="#050505"/>`,
    `<text x="200" y="54" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="400" text-anchor="middle">Personal card</text>`,
    `<rect x="${qrX - 8}" y="${qrY - 8}" width="${qrDisplaySize + 16}" height="${qrDisplaySize + 16}" rx="22" fill="#FFFFFF"/>`,
    `<image href="${qrDataUri}" x="${qrX}" y="${qrY}" width="${qrDisplaySize}" height="${qrDisplaySize}" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="200" y="372" fill="#D7D7D7" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="400" text-anchor="middle">${name}</text>`,
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

export { buildVirtualBackgroundLayout, VIRTUAL_BG_PANEL } from "./virtual-background-layout.ts";
