type VirtualBackgroundProfile = {
  role: string;
  company: string;
  showCompany?: boolean;
};

/** Canonical layout for the top-right contact panel (matches 1920×1080 export). */
export const VIRTUAL_BG_PANEL = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  x: 1510,
  y: 48,
  width: 380,
  pad: 28,
  qrSize: 220,
  nameFontSize: 30,
  subtitleFontSize: 18,
  scanFontSize: 16,
  nameTop: 32,
  subtitleTop: 72,
  textGapBeforeQr: 20,
  scanGapAfterQr: 14,
  bottomPad: 24,
} as const;

export type VirtualBackgroundLayout = {
  subtitle: string;
  panelHeight: number;
  nameY: number;
  subtitleY: number;
  qrX: number;
  qrY: number;
  scanX: number;
  scanY: number;
  preview: {
    qrSize: number;
    pad: number;
    textGapBeforeQr: number;
    scanGapAfterQr: number;
    nameFontSize: number;
    subtitleFontSize: number;
    scanFontSize: number;
  };
};

export function buildVirtualBackgroundLayout(
  profile: VirtualBackgroundProfile,
  previewPanelWidth = 228,
): VirtualBackgroundLayout {
  const role = profile.role.trim();
  const company = profile.showCompany !== false ? profile.company.trim() : "";
  const subtitle = [role, company].filter(Boolean).join(" · ");
  const hasSubtitle = Boolean(subtitle);

  const qrTop = hasSubtitle
    ? VIRTUAL_BG_PANEL.subtitleTop + 28 + VIRTUAL_BG_PANEL.textGapBeforeQr
    : VIRTUAL_BG_PANEL.nameTop + 34 + VIRTUAL_BG_PANEL.textGapBeforeQr;

  const panelHeight =
    qrTop +
    VIRTUAL_BG_PANEL.qrSize +
    VIRTUAL_BG_PANEL.scanGapAfterQr +
    18 +
    VIRTUAL_BG_PANEL.bottomPad;

  const qrX = VIRTUAL_BG_PANEL.x + Math.round((VIRTUAL_BG_PANEL.width - VIRTUAL_BG_PANEL.qrSize) / 2);
  const qrY = VIRTUAL_BG_PANEL.y + qrTop;
  const scanX = VIRTUAL_BG_PANEL.x + Math.round(VIRTUAL_BG_PANEL.width / 2);
  const scanY = qrY + VIRTUAL_BG_PANEL.qrSize + VIRTUAL_BG_PANEL.scanGapAfterQr + 14;
  const nameY = VIRTUAL_BG_PANEL.y + VIRTUAL_BG_PANEL.nameTop + 24;
  const subtitleY = VIRTUAL_BG_PANEL.y + VIRTUAL_BG_PANEL.subtitleTop + 14;

  const scale = previewPanelWidth / VIRTUAL_BG_PANEL.width;

  return {
    subtitle,
    panelHeight,
    nameY,
    subtitleY,
    qrX,
    qrY,
    scanX,
    scanY,
    preview: {
      qrSize: Math.round(VIRTUAL_BG_PANEL.qrSize * scale),
      pad: Math.round(VIRTUAL_BG_PANEL.pad * scale),
      textGapBeforeQr: Math.round(VIRTUAL_BG_PANEL.textGapBeforeQr * scale),
      scanGapAfterQr: Math.round(VIRTUAL_BG_PANEL.scanGapAfterQr * scale),
      nameFontSize: Math.max(12, Math.round(VIRTUAL_BG_PANEL.nameFontSize * scale)),
      subtitleFontSize: Math.max(10, Math.round(VIRTUAL_BG_PANEL.subtitleFontSize * scale)),
      scanFontSize: Math.max(9, Math.round(VIRTUAL_BG_PANEL.scanFontSize * scale)),
    },
  };
}
