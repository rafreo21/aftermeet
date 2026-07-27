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
    themeColor: "#9FE870",
  });
  assert.match(html, /View my card/);
  assert.match(html, /alex@aftermeet.app/);
  assert.match(html, /AfterMeet email signature/);
});
