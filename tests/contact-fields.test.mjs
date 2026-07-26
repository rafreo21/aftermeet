import assert from "node:assert/strict";
import test from "node:test";

import {
  isLikelyPersonalEmail,
  isLikelyWorkEmail,
  isValidPhoneNumber,
  sanitizePhoneNumber,
  splitCapturedEmails,
} from "../lib/contact-fields.ts";

test("sanitizePhoneNumber rejects year-like values", () => {
  assert.equal(sanitizePhoneNumber("2026"), "");
  assert.equal(sanitizePhoneNumber("2024"), "");
  assert.equal(sanitizePhoneNumber("+447473177720"), "+447473177720");
  assert.equal(isValidPhoneNumber("+1 555 123 4567"), true);
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
