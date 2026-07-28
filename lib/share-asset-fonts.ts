import { readFile } from "node:fs/promises";
import { join } from "node:path";

let fontsPromise: Promise<{ regular: string; bold: string }> | null = null;

export async function loadShareAssetFontsBase64() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const root = join(process.cwd(), "node_modules/@fontsource/inter/files");
      const [regular, bold] = await Promise.all([
        readFile(join(root, "inter-latin-400-normal.woff")),
        readFile(join(root, "inter-latin-700-normal.woff")),
      ]);
      return {
        regular: regular.toString("base64"),
        bold: bold.toString("base64"),
      };
    })();
  }
  return fontsPromise;
}

export function shareAssetFontStyles(regularBase64: string, boldBase64: string) {
  return [
    `@font-face{font-family:'Inter';font-style:normal;font-weight:400;src:url(data:font/woff;base64,${regularBase64}) format('woff');}`,
    `@font-face{font-family:'Inter';font-style:normal;font-weight:700;src:url(data:font/woff;base64,${boldBase64}) format('woff');}`,
  ].join("");
}
