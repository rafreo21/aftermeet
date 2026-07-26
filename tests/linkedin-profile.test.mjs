import test from "node:test";
import assert from "node:assert/strict";

import { normalizeLinkedInUrl, parseLinkedInProfileInput } from "../lib/linkedin-profile.ts";

test("parseLinkedInProfileInput extracts handle without guessing a name", () => {
  const profile = parseLinkedInProfileInput("https://linkedin.com/in/jane-doe");
  assert.ok(profile);
  assert.equal(profile.handle, "jane-doe");
  assert.equal(profile.firstName, "");
  assert.equal(profile.lastName, "");
});

test("parseLinkedInProfileInput accepts bare handles", () => {
  const profile = parseLinkedInProfileInput("alex-morgan");
  assert.ok(profile);
  assert.equal(profile.handle, "alex-morgan");
  assert.equal(normalizeLinkedInUrl(profile.url), "https://www.linkedin.com/in/alex-morgan");
});

test("parseLinkedInProfileInput rejects invalid values", () => {
  assert.equal(parseLinkedInProfileInput(""), null);
  assert.equal(parseLinkedInProfileInput("hello world!"), null);
});
