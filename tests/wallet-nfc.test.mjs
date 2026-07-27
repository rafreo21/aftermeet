import test from "node:test";
import assert from "node:assert/strict";

import { nfcManufacturerPayload, nfcUriRecord, normalizeCardUrl } from "../lib/nfc-ndef.ts";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "../lib/wallet-config.ts";

test("normalizeCardUrl adds https when missing", () => {
  assert.equal(normalizeCardUrl("aftermeet.app/c/alex-morgan"), "https://aftermeet.app/c/alex-morgan");
});

test("nfcUriRecord returns a URL record for Web NFC", () => {
  assert.deepEqual(nfcUriRecord("https://aftermeet.app/c/alex-morgan"), {
    recordType: "url",
    data: "https://aftermeet.app/c/alex-morgan",
  });
});

test("nfcManufacturerPayload documents the tap-to-open URL", () => {
  const payload = nfcManufacturerPayload("https://aftermeet.app/c/alex-morgan");
  assert.equal(payload.url, "https://aftermeet.app/c/alex-morgan");
  assert.equal(payload.recordType, "URI");
});

test("wallet config flags are false without env vars", () => {
  assert.equal(isAppleWalletConfigured(), false);
  assert.equal(isGoogleWalletConfigured(), false);
});

test("html email signature includes structured layout and card link", async () => {
  const { buildHtmlSignature } = await import("../lib/email-signature.ts");
  const html = buildHtmlSignature({
    name: "Alex Morgan",
    role: "Product designer",
    company: "AfterMeet",
    cardUrl: "https://aftermeet.app/c/alex-morgan",
    email: "alex@aftermeet.app",
    phone: "+1 555 0100",
    themeColor: "#9FE870",
  });
  assert.match(html, /View my card/);
  assert.match(html, /alex@aftermeet.app/);
  assert.match(html, /Product designer/);
  assert.match(html, /AfterMeet email signature/);
});

test("virtual background svg includes name and qr overlay", async () => {
  const { buildVirtualBackgroundSvg } = await import("../lib/share-assets.ts");
  const svg = await buildVirtualBackgroundSvg({
    name: "Alex Morgan",
    role: "Consultant",
    company: "Northstar",
    cardUrl: "https://aftermeet.app/c/alex-morgan",
    themeColor: "#9FE870",
  });
  assert.match(svg, /Alex Morgan/);
  assert.match(svg, /1920/);
  assert.match(svg, /data:image\/png;base64,/);
});

test("watch face svg includes personal card label", async () => {
  const { buildWatchFaceSvg } = await import("../lib/share-assets.ts");
  const svg = await buildWatchFaceSvg({
    name: "Alex Morgan",
    role: "Consultant",
    company: "Northstar",
    cardUrl: "https://aftermeet.app/c/alex-morgan",
  });
  assert.match(svg, /Personal card/);
  assert.match(svg, /Alex Morgan/);
});

test("publicCardImageUrl rejects device-local URIs", async () => {
  const { publicCardImageUrl, needsCardImageUpload } = await import("../lib/card-assets.ts");
  assert.equal(publicCardImageUrl("file:///var/mobile/photo.jpg"), null);
  assert.equal(publicCardImageUrl("content://media/external/images/1"), null);
  assert.equal(publicCardImageUrl("https://cdn.example.com/profile.jpg"), "https://cdn.example.com/profile.jpg");
  assert.equal(needsCardImageUpload("file:///photo.jpg"), true);
  assert.equal(needsCardImageUpload("https://cdn.example.com/profile.jpg"), false);
});
