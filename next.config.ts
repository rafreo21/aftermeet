import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/mobile/share-assets/[slug]": [
      "./public/aftermeet-mark.png",
      "./lib/aftermeet-logo-base64.ts",
    ],
    "/api/cards/share-assets/[slug]": [
      "./public/aftermeet-mark.png",
      "./lib/aftermeet-logo-base64.ts",
    ],
  },
};

export default nextConfig;
