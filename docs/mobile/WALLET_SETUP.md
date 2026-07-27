# Wallet setup (Apple + Google)

Wallet passes are generated on the AfterMeet server. The mobile app calls the API; if the server is missing issuer credentials, you'll see **"not configured for this environment."**

## Required environment variables (Vercel)

Add these in the AfterMeet project on Vercel → Settings → Environment Variables → Production + Preview.

### Google Wallet

| Variable | Description |
|----------|-------------|
| `GOOGLE_WALLET_ISSUER_ID` | Issuer ID from [Google Pay & Wallet Console](https://pay.google.com/business/console) |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | Full JSON for a service account with Wallet Objects access |
| `GOOGLE_WALLET_CLASS_SUFFIX` | Optional. Defaults to `aftermeet_card` |
| `NEXT_PUBLIC_APP_URL` | Public app URL used in pass links, e.g. `https://aftermeet-beta.vercel.app` |

**Console steps**

1. Create or open a Google Wallet issuer.
2. Enable the **Google Wallet API** on your GCP project.
3. Create a service account and download JSON.
4. In Wallet Console → Users, grant the service account **Developer** or **Admin** access.
5. Paste the JSON into `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` (single line is fine).

### Apple Wallet

| Variable | Description |
|----------|-------------|
| `APPLE_WALLET_PASS_TYPE_ID` | e.g. `pass.com.aftermeet.card` |
| `APPLE_WALLET_TEAM_ID` | Apple Developer Team ID |
| `APPLE_WALLET_WWDR_CERT` | Apple WWDR intermediate certificate (PEM) |
| `APPLE_WALLET_SIGNER_CERT` | Pass signing certificate (PEM) |
| `APPLE_WALLET_SIGNER_KEY` | Private key (PEM) |
| `APPLE_WALLET_SIGNER_KEY_PASSPHRASE` | Optional |

**Apple Developer steps**

1. Register a Pass Type ID.
2. Create a Pass Type ID certificate and export cert + key as PEM.
3. Download the [Apple WWDR certificate](https://www.apple.com/certificateauthority/).
4. Add all PEM values to Vercel (use `\n` for newlines or store as single-line PEM blocks).

## Verify configuration

After deploying with env vars:

```bash
curl -H "Authorization: Bearer <mobile-access-token>" \
  https://aftermeet-beta.vercel.app/api/mobile/wallet/status
```

Expected when configured:

```json
{
  "apple": { "configured": true, "message": "" },
  "google": { "configured": true, "message": "" }
}
```

## Mobile behaviour

- **Google (Android):** opens `https://pay.google.com/gp/v/save/...` in the browser.
- **Apple (iOS):** downloads `.pkpass` and opens the share sheet → Add to Wallet.
- Card must be **published** before a pass can be created.

## NFC + home-screen widget

These do not use server wallet credentials:

- **NFC write** — Android native build + physical NTAG tag.
- **Home-screen widget** — native build (`expo prebuild` / EAS). Tap **Open QR** → `aftermeet://share-card` → in-app QR screen.

Rebuild the mobile app after changing the Android widget plugin.
