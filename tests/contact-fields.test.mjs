import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCountryCodeIfNeeded,
  inferDialCodeFromLocation,
  isLikelyPersonalEmail,
  isLikelyWorkEmail,
  isValidPhoneNumber,
  normalizePhoneNumber,
  sanitizePhoneNumber,
  splitCapturedEmails,
} from "../lib/contact-fields.ts";

test("sanitizePhoneNumber rejects year-like values", () => {
  assert.equal(sanitizePhoneNumber("2026"), "");
  assert.equal(sanitizePhoneNumber("2024"), "");
  assert.equal(sanitizePhoneNumber("+447473177720"), "+447473177720");
  assert.equal(isValidPhoneNumber("+1 555 123 4567"), true);
});

test("sanitizePhoneNumber accepts international numbers across regions", () => {
  assert.equal(sanitizePhoneNumber("+234 803 123 4567"), "+2348031234567");
  assert.equal(sanitizePhoneNumber("+971 50 123 4567"), "+971501234567");
  assert.equal(sanitizePhoneNumber("08031234567", { locationHint: "Lagos, Nigeria" }), "+2348031234567");
  assert.equal(sanitizePhoneNumber("07473177720", { locationHint: "London, United Kingdom" }), "+447473177720");
  assert.equal(sanitizePhoneNumber("5551234567", { locationHint: "San Francisco, United States" }), "+15551234567");
});

test("normalizePhoneNumber preserves explicit country codes", () => {
  assert.equal(normalizePhoneNumber("+44 7473 177720"), "+447473177720");
  assert.equal(normalizePhoneNumber("0044 7473 177720"), "+447473177720");
});

test("inferDialCodeFromLocation maps common LinkedIn locations", () => {
  assert.equal(inferDialCodeFromLocation("Lagos, Nigeria"), "234");
  assert.equal(inferDialCodeFromLocation("United Kingdom"), "44");
  assert.equal(applyCountryCodeIfNeeded("8031234567", "234"), "+2348031234567");
});

test("splitCapturedEmails separates personal and work addresses", () => {
  assert.deepEqual(
    splitCapturedEmails({
      email: "rafreo21@gmail.com",
      company: "Nexleaf Analytics",
    }),
    {
      email: "rafreo21@gmail.com",
      workEmail: "",
      personalEmail: "rafreo21@gmail.com",
    },
  );

  assert.deepEqual(
    splitCapturedEmails({
      workEmail: "oluwatosin.kazeem@autospend.com",
      personalEmail: "tosin@gmail.com",
      company: "Autospend",
    }),
    {
      email: "oluwatosin.kazeem@autospend.com",
      workEmail: "oluwatosin.kazeem@autospend.com",
      personalEmail: "tosin@gmail.com",
    },
  );
});

test("isLikelyWorkEmail matches company domain guesses", () => {
  assert.equal(isLikelyWorkEmail("oluwatosin.kazeem@autospend.com", "Autospend"), true);
  assert.equal(isLikelyPersonalEmail("rafreo21@gmail.com"), true);
});
