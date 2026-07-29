import test from "node:test";
import assert from "node:assert/strict";

import { parseAfterMeetCardSlug, parseScanTarget } from "../lib/scan-targets.ts";

test("parseScanTarget detects AfterMeet card URLs", () => {
  const target = parseScanTarget("https://aftermeet.app/c/alex-morgan");
  assert.equal(target.type, "aftermeet_card");
  if (target.type === "aftermeet_card") {
    assert.equal(target.slug, "alex-morgan");
  }
});

test("parseScanTarget detects LinkedIn profile URLs", () => {
  const target = parseScanTarget("https://www.linkedin.com/in/jane-doe?utm_source=qr");
  assert.equal(target.type, "linkedin");
  if (target.type === "linkedin") {
    assert.equal(target.handle, "jane-doe");
    assert.match(target.url, /linkedin\.com\/in\/jane-doe/);
  }
});

test("parseScanTarget detects vCard payloads", () => {
  const target = parseScanTarget("BEGIN:VCARD\nFN:Alex Morgan\nEND:VCARD");
  assert.equal(target.type, "vcard");
});

test("parseAfterMeetCardSlug ignores non-card paths", () => {
  assert.equal(parseAfterMeetCardSlug("https://aftermeet.app/app/contacts"), null);
});

test("parseAfterMeetCardSlugFromScan extracts slug from offline vCard QRs", async () => {
  const { parseAfterMeetCardSlugFromScan } = await import("../mobile/src/lib/parse-scanned-qr.ts");
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Alex Morgan",
    "item1.URL:https://aftermeet.app/c/alex-morgan",
    "item1.X-ABLabel:AfterMeet card",
    "END:VCARD",
  ].join("\r\n");

  assert.equal(parseAfterMeetCardSlugFromScan(vcard), "alex-morgan");
  assert.equal(parseAfterMeetCardSlugFromScan("https://aftermeet.app/c/alex-morgan"), "alex-morgan");
});
