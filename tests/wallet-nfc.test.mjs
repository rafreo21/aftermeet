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
