import test from "node:test";
import assert from "node:assert/strict";

import {
  isLinkedInAuthWall,
  linkedInHandleInHtml,
  parseLinkedInOpenGraphTitle,
  parseLinkedInProfileHtml,
} from "../lib/linkedin-enrichment.ts";

test("parseLinkedInOpenGraphTitle extracts name, role, and company", () => {
  const profile = parseLinkedInOpenGraphTitle("Raphael Freo - Designer at Northstar | LinkedIn");
  assert.ok(profile);
  assert.equal(profile.firstName, "Raphael");
  assert.equal(profile.lastName, "Freo");
  assert.equal(profile.role, "Designer");
  assert.equal(profile.company, "Northstar");
});

test("parseLinkedInOpenGraphTitle supports middle-dot headlines", () => {
  const profile = parseLinkedInOpenGraphTitle("Raphael Okojie - Product Designer · Nexleaf Analytics | LinkedIn");
  assert.ok(profile);
  assert.equal(profile.firstName, "Raphael");
  assert.equal(profile.lastName, "Okojie");
  assert.equal(profile.role, "Product Designer");
  assert.equal(profile.company, "Nexleaf Analytics");
});

test("parseLinkedInOpenGraphTitle rejects generic LinkedIn titles", () => {
  assert.equal(parseLinkedInOpenGraphTitle("Sign In | LinkedIn"), null);
  assert.equal(parseLinkedInOpenGraphTitle("LinkedIn"), null);
});

test("parseLinkedInProfileHtml rejects auth walls and mismatched handles", () => {
  const authWall = `
    <meta property="og:title" content="Sign In | LinkedIn" />
    <meta property="og:description" content="Join LinkedIn" />
  `;
  assert.equal(parseLinkedInProfileHtml(authWall, "rafreo"), null);

  const wrongPerson = `
    <meta property="og:url" content="https://www.linkedin.com/in/carlos-navarro" />
    <meta property="og:title" content="Carlos Navarro - Ticor Title Company | LinkedIn" />
  `;
  assert.equal(parseLinkedInProfileHtml(wrongPerson, "rafreo"), null);
});

test("parseLinkedInProfileHtml accepts matching public profile metadata", () => {
  const html = `
    <meta property="og:url" content="https://www.linkedin.com/in/rafreo" />
    <meta property="og:title" content="Raphael Freo - Designer at Northstar | LinkedIn" />
    <meta property="og:description" content="Designer at Northstar" />
  `;
  assert.ok(linkedInHandleInHtml(html, "rafreo"));
  const profile = parseLinkedInProfileHtml(html, "rafreo");
  assert.ok(profile);
  assert.equal(profile.firstName, "Raphael");
  assert.equal(profile.company, "Northstar");
});

test("isLinkedInAuthWall detects auth wall markup", () => {
  assert.equal(isLinkedInAuthWall('<div class="authwall-join-form"></div>'), true);
});
