import { Resvg } from "@resvg/resvg-js";

import { normalizeThemeColor, themeGradientStops } from "./theme-contrast.ts";
import { VIRTUAL_BG_PANEL } from "./virtual-background-layout.ts";

/** Render the card theme gradient with resvg (reliable on Linux/Vercel; sharp/librsvg often drops gradients). */
export function buildVirtualBackgroundGradientPng(themeColor: string | undefined) {
  const [highlight, base, shadow] = themeGradientStops(normalizeThemeColor(themeColor));
  const width = VIRTUAL_BG_PANEL.canvasWidth;
  const height = VIRTUAL_BG_PANEL.canvasHeight;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs>`,
    `<linearGradient id="cardThemeBg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="${height}">`,
    `<stop offset="0%" stop-color="${highlight}"/>`,
    `<stop offset="48%" stop-color="${base}"/>`,
    `<stop offset="100%" stop-color="${shadow}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${width}" height="${height}" fill="url(#cardThemeBg)"/>`,
    `</svg>`,
  ].join("");

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
  });
  return resvg.render().asPng();
}
