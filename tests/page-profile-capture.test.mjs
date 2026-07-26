import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLinkedInCaptureContext,
  LINKEDIN_PROFILE_FIXTURE,
  parseContactInfoFromText,
  parseExperienceFromText,
  parseHeadline,
} from "../lib/linkedin-page-capture.ts";
import { captureFromLinkedInDocument } from "../lib/page-profile-capture.ts";

test("parseHeadline supports role at company", () => {
  assert.deepEqual(parseHeadline("Product Designer at Nexleaf Analytics"), {
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("parseExperienceFromText reads the current job from the Experience section", () => {
  assert.deepEqual(parseExperienceFromText(LINKEDIN_PROFILE_FIXTURE), {
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("parseContactInfoFromText ignores year-like phone values", () => {
  const parsed = parseContactInfoFromText([
    "Contact info",
    "Email",
    "tosin@gmail.com",
    "Mobile",
    "2026",
  ].join("\n"));
  assert.equal(parsed.email, "tosin@gmail.com");
  assert.equal(parsed.phone, "");
});
  assert.deepEqual(parseContactInfoFromText(LINKEDIN_PROFILE_FIXTURE), {
    email: "rafreo21@gmail.com",
    phone: "+447473177720",
  });
  assert.deepEqual(parseContactInfoFromText(`
Contact info
Email
someone@example.com
Phone
+1 (555) 123-4567 (Mobile)
`.trim()), {
    email: "someone@example.com",
    phone: "+15551234567",
  });
});

test("buildLinkedInCaptureContext writes useful notes", () => {
  const context = buildLinkedInCaptureContext({
    role: "Product Designer",
    company: "Nexleaf Analytics",
    email: "rafreo21@gmail.com",
    phone: "+447473177720",
    linkedinUrl: "https://www.linkedin.com/in/rafreo",
  });
  assert.match(context, /Current role: Product Designer at Nexleaf Analytics/);
  assert.match(context, /rafreo21@gmail.com/);
  assert.match(context, /\+447473177720/);
});

test("captureFromLinkedInDocument prefers experience over profile badges", () => {
  const profile = captureFromLinkedInDocument({
    title: "Raphael Okojie | LinkedIn",
    location: { href: "https://www.linkedin.com/in/rafreo" },
    body: { innerText: LINKEDIN_PROFILE_FIXTURE },
    querySelector(selector) {
      if (selector.includes("og:title")) {
        return { getAttribute: () => "Raphael Okojie - Product Designer at Nexleaf | LinkedIn" };
      }
      if (selector === "h1") return { textContent: "Raphael Okojie" };
      return null;
    },
    querySelectorAll() {
      return [];
    },
  });

  assert.equal(profile.fullName, "Raphael Okojie");
  assert.equal(profile.role, "Product Designer");
  assert.equal(profile.company, "Nexleaf Analytics");
  assert.equal(profile.email, "rafreo21@gmail.com");
  assert.equal(profile.phone, "+447473177720");
  assert.match(profile.context || "", /Current role: Product Designer at Nexleaf Analytics/);
});
