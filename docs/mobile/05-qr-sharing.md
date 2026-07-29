# QR sharing — online vs offline

AfterMeet uses two QR modes on **Quick Share**. Every other share surface defaults to **online** (card URL).

## Online (default)

- **Quick Share:** toggle **Online contact QR** ON
- **Widgets, Wallet, tap-to-share, capture flow, email signature, virtual background:** always online
- QR encodes `https://aftermeet-beta.vercel.app/c/{slug}` (or your configured `NEXT_PUBLIC_APP_URL`)

**Visitor with phone camera + internet**

1. Camera scans QR → browser opens public card page
2. Visitor saves contact and/or fills **Share back** form
3. Owner sees inbound exchange in AfterMeet

This is the primary visitor flow. Do not use vCard-only QRs for events where share-back matters.

## Offline (opt-in)

- **Quick Share only:** toggle **Online contact QR** OFF → title shows **Offline contact QR active**
- QR encodes a vCard with contact details and an embedded AfterMeet card link
- Preference is remembered on the device

**Visitor with phone camera (no internet required for save)**

1. Camera scans QR → Contacts app opens
2. Contact saves locally with phone, email, and AfterMeet link
3. Share-back happens only after they open the AfterMeet link when online

Heavy cards automatically use a compact or minimal vCard so the QR still renders.

## AfterMeet in-app scanner

Quick Scan inside the app is for **AfterMeet users** adding cards to their network — not the public visitor flow.

| Scan type | In-app scanner | Phone camera |
|-----------|----------------|--------------|
| Online URL QR | Adds to connections | Opens card page |
| Offline vCard QR | Adds if AfterMeet link present | Saves to Contacts |

## Before testing

1. Card is **published** on beta
2. Public URL loads: `https://aftermeet-beta.vercel.app/c/{slug}`
3. Mobile app reloaded from Metro after latest changes

## Tap to share + Wallet

- **Tap to share (Android):** shares the card URL over NFC — requires a dev/prod build with the HCE native module
- **Google / Apple Wallet:** barcode is URL-only (platform requirement)

See [WALLET_SETUP.md](./WALLET_SETUP.md) for server credentials.
