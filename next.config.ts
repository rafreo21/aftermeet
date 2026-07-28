import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/mobile/share-assets/[slug]": [
      "./public/aftermeet-mark.png",
      "./lib/aftermeet-logo-base64.ts",
      "./node_modules/@fontsource/inter/files/inter-latin-400-normal.woff",
      "./node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
    ],
    "/api/cards/share-assets/[slug]": [
      "./public/aftermeet-mark.png",
      "./lib/aftermeet-logo-base64.ts",
      "./node_modules/@fontsource/inter/files/inter-latin-400-normal.woff",
      "./node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
    ],
  },
};

export default nextConfig;
