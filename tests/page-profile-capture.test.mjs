import test from "node:test";
import assert from "node:assert/strict";

import {
  captureFromLinkedInDocument,
  parseHeadline,
} from "../lib/page-profile-capture.ts";

test("parseHeadline supports role at company", () => {
  assert.deepEqual(parseHeadline("Product Designer at Nexleaf Analytics"), {
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("parseHeadline supports role and company separated by a middle dot", () => {
  assert.deepEqual(parseHeadline("Product Designer · Nexleaf Analytics"), {
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("captureFromLinkedInDocument reads open graph metadata and page headline", () => {
  const profile = captureFromLinkedInDocument({
    title: "Raphael Okojie | LinkedIn",
    location: { href: "https://www.linkedin.com/in/rafreo" },
    body: {
      innerText: "Raphael Okojie\nProduct Designer · Nexleaf Analytics\nConnect\nMessage",
    },
    querySelector(selector) {
      if (selector.includes("og:title")) {
        return { getAttribute: () => "Raphael Okojie - Product Designer · Nexleaf Analytics | LinkedIn" };
      }
      if (selector.includes("og:description")) {
        return { getAttribute: () => "Product Designer · Nexleaf Analytics" };
      }
      if (selector === "h1") return { textContent: "Raphael Okojie" };
      return null;
    },
    querySelectorAll() {
      return [];
    },
  });

  assert.equal(profile.firstName, "Raphael");
  assert.equal(profile.lastName, "Okojie");
  assert.equal(profile.role, "Product Designer");
  assert.equal(profile.company, "Nexleaf Analytics");
  assert.equal(profile.linkedinUrl, "https://www.linkedin.com/in/rafreo");
});
