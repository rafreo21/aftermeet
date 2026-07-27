import { NextResponse } from "next/server";

import { getAppUserFromRequest } from "../../../../../lib/auth/mobile-api-auth";
import { walletSetupStatus } from "../../../../../lib/wallet-config";

export async function GET(request: Request) {
  const user = await getAppUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const status = walletSetupStatus();
  return NextResponse.json(
    {
      apple: {
        configured: status.apple,
        message: status.apple
          ? ""
          : "Apple Wallet signing is not configured on the server yet.",
      },
      google: {
        configured: status.google,
        message: status.google
          ? ""
          : "Google Wallet is not configured on the server yet.",
      },
      setup: {
        apple: [
          "APPLE_WALLET_PASS_TYPE_ID",
          "APPLE_WALLET_TEAM_ID",
          "APPLE_WALLET_WWDR_CERT",
          "APPLE_WALLET_SIGNER_CERT",
          "APPLE_WALLET_SIGNER_KEY",
        ],
        google: ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON"],
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
