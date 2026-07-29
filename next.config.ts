import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@resvg/resvg-js", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/mobile/share-assets/[slug]": [
      "./public/aftermeet-mark.png",
      "./lib/aftermeet-logo-base64.ts",
      "./lib/share-asset-fonts-data.ts",
    ],
    "/api/cards/share-assets/[slug]": [
      "./public/aftermeet-mark.png",
      "./lib/aftermeet-logo-base64.ts",
      "./lib/share-asset-fonts-data.ts",
    ],
    "/api/encounters/transcribe": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
