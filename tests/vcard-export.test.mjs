import test from "node:test";
import assert from "node:assert/strict";

import { buildCardVcard, escapeVcard } from "../lib/vcard-export.ts";

test("escapeVcard escapes commas, semicolons, and newlines", () => {
  assert.equal(escapeVcard("A, B; C\nD"), "A\\, B\\; C\\nD");
});

test("buildCardVcard writes structured name fields for iOS and Android", () => {
  const { body } = buildCardVcard({
    fullName: "Raphael Okojie",
    jobTitle: "Product Designer",
    company: "Nexleaf Analytics",
    bio: "Design systems and product strategy.",
    cardUrl: "https://aftermeet-beta.vercel.app/c/card-abc",
    methods: [
      { method_type: "email", value: "rafreo21@gmail.com" },
      { method_type: "linkedin", value: "https://linkedin.com/in/rafreo" },
      { method_type: "website", value: "https://rafreo.webflow.io" },
    ],
    scannedAt: new Date("2026-07-26T12:00:00.000Z"),
  });

  assert.match(body, /^BEGIN:VCARD\r\n/);
  assert.match(body, /N:Okojie;Raphael;;;/);
  assert.match(body, /FN:Raphael Okojie/);
  assert.match(body, /ORG:Nexleaf Analytics/);
  assert.match(body, /TITLE:Product Designer/);
  assert.match(body, /EMAIL;TYPE=INTERNET:rafreo21@gmail.com/);
  assert.match(body, /URL:https:\/\/rafreo\.webflow\.io/);
  assert.match(body, /item1\.URL:https:\/\/linkedin\.com\/in\/rafreo/);
  assert.match(body, /item1\.X-ABLabel:LinkedIn/);
  assert.doesNotMatch(body, /URL:https:\/\/aftermeet-beta\.vercel\.app/);
  assert.match(body, /NOTE:.*When we met: 26 July 2026/s);
  assert.match(body, /END:VCARD\r\n$/);
});

test("buildCardVcard normalizes phone numbers for contact apps", () => {
  const { body } = buildCardVcard({
    fullName: "Alex Morgan",
    cardUrl: "https://aftermeet.app/c/alex",
    methods: [{ method_type: "phone", value: "+44 7473 177720" }],
  });

  assert.match(body, /TEL;TYPE=CELL,VOICE:\+447473177720/);
});

test("buildCardVcard slugifies the download filename", () => {
  const { filename } = buildCardVcard({
    fullName: "Raphael Okojie",
    cardUrl: "https://aftermeet.app/c/card",
    methods: [],
  });

  assert.equal(filename, "raphael-okojie");
});

test("buildCardVcard exports every social link with labels for phone contacts", () => {
  const { body } = buildCardVcard({
    fullName: "Alex Morgan",
    cardUrl: "https://aftermeet.app/c/alex",
    methods: [
      { method_type: "x", value: "@alexm" },
      { method_type: "instagram", value: "alexm", label: "Instagram" },
      { method_type: "tiktok", value: "@alexm" },
      { method_type: "linkedin", value: "alex-morgan" },
    ],
  });

  assert.match(body, /item1\.URL:https:\/\/x\.com\/alexm/);
  assert.match(body, /item1\.X-ABLabel:X/);
  assert.match(body, /item2\.URL:https:\/\/instagram\.com\/alexm/);
  assert.match(body, /item3\.URL:https:\/\/tiktok\.com\/@alexm/);
  assert.match(body, /item4\.URL:https:\/\/linkedin\.com\/in\/alex-morgan/);
});
