import QRCode from "qrcode";

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

export async function buildQrPngDataUri(cardUrl: string, size = 512) {
  const dataUrl = await QRCode.toDataURL(cardUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: size,
    color: { dark: "#163300", light: "#FFFFFF" },
  });
  return dataUrl;
}

export async function buildVirtualBackgroundSvg(profile: ShareAssetProfile) {
  const theme = normalizeHex(profile.themeColor);
  const softTop = tint(theme, 0.55);
  const softBottom = tint(theme, 0.78);
  const name = escapeXml(profile.name.trim() || "Your name");
  const role = escapeXml(profile.role.trim());
  const company = profile.showCompany !== false ? escapeXml(profile.company.trim()) : "";
  const qrDataUri = await buildQrPngDataUri(profile.cardUrl, 280);
  const subtitle = [role, company].filter(Boolean).join(" · ");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${softTop}"/>`,
    `<stop offset="100%" stop-color="${softBottom}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="1920" height="1080" fill="url(#bg)"/>`,
    `<rect x="1460" y="72" width="360" height="168" rx="20" fill="#FFFFFF" fill-opacity="0.94"/>`,
    `<text x="1488" y="118" fill="#163300" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${name}</text>`,
    subtitle
      ? `<text x="1488" y="152" fill="#53634D" font-family="Arial, Helvetica, sans-serif" font-size="18">${escapeXml(subtitle)}</text>`
      : "",
    `<rect x="1748" y="96" width="56" height="56" rx="10" fill="#E9F7DF"/>`,
    `<image href="${qrDataUri}" x="1748" y="96" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="1488" y="206" fill="#71806B" font-family="Arial, Helvetica, sans-serif" font-size="14">Scan to save my contact</text>`,
    `</svg>`,
  ].filter(Boolean).join("");
}

export async function buildWatchFaceSvg(profile: ShareAssetProfile) {
  const name = escapeXml(profile.name.trim() || "My card");
  const qrDataUri = await buildQrPngDataUri(profile.cardUrl, 320);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">`,
    `<rect width="400" height="400" rx="56" fill="#050505"/>`,
    `<text x="200" y="54" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle">Personal card</text>`,
    `<rect x="72" y="84" width="256" height="256" rx="18" fill="#FFFFFF"/>`,
    `<image href="${qrDataUri}" x="88" y="100" width="224" height="224" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="200" y="372" fill="#D7D7D7" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle">${name}</text>`,
    `</svg>`,
  ].join("");
}

export function shareAssetFilename(type: "virtual-background" | "watch-face", slug: string) {
  return `aftermeet-${type}-${slug}.svg`;
}
