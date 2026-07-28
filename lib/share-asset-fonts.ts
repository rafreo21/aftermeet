import { INTER_400_WOFF_BASE64, INTER_700_WOFF_BASE64 } from "./share-asset-fonts-data.ts";

export async function loadShareAssetFontsBase64() {
  return {
    regular: INTER_400_WOFF_BASE64,
    bold: INTER_700_WOFF_BASE64,
  };
}

export function loadShareAssetFontBuffers() {
  return {
    regular: Buffer.from(INTER_400_WOFF_BASE64, "base64"),
    bold: Buffer.from(INTER_700_WOFF_BASE64, "base64"),
  };
}

export function shareAssetFontStyles(regularBase64: string, boldBase64: string) {
  return [
    `@font-face{font-family:'Inter';font-style:normal;font-weight:400;src:url(data:font/woff;base64,${regularBase64}) format('woff');}`,
    `@font-face{font-family:'Inter';font-style:normal;font-weight:700;src:url(data:font/woff;base64,${boldBase64}) format('woff');}`,
  ].join("");
}
