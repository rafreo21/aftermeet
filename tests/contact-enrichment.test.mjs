import assert from "node:assert/strict";
import test from "node:test";

import {
  enrichContactField,
  guessCompanyDomain,
  guessWorkEmail,
} from "../lib/contact-enrichment.ts";

test("guessCompanyDomain strips legal suffixes and parentheses", () => {
  assert.equal(guessCompanyDomain("Autospend (Formerly Collect App)"), "autospend.com");
  assert.equal(guessCompanyDomain("Nexleaf Analytics, Inc."), "nexleafanalytics.com");
});

test("guessWorkEmail builds a first.last pattern", () => {
  assert.equal(
    guessWorkEmail("Oluwatosin Kazeem", "Autospend"),
    "oluwatosin.kazeem@autospend.com",
  );
});

test("enrichContactField prefers LinkedIn seed email over pattern guess", async () => {
  const result = await enrichContactField({
    fullName: "Raphael Okojie",
    company: "Nexleaf Analytics",
    field: "email",
    seedEmail: "rafreo21@gmail.com",
  });

  assert.equal(result.value, "rafreo21@gmail.com");
  assert.equal(result.provider, "linkedin");
  assert.equal(result.steps[0]?.status, "found");
});

test("enrichContactField falls back to pattern guess when LinkedIn is empty", async () => {
  const result = await enrichContactField({
    fullName: "Ken Wu",
    company: "Stripe",
    field: "email",
  });

  assert.equal(result.value, "ken.wu@stripe.com");
  assert.equal(result.provider, "pattern");
});

test("enrichContactField skips Hunter when API key is missing", async () => {
  const result = await enrichContactField({
    fullName: "Ken Wu",
    company: "Stripe",
    field: "email",
  });

  const hunter = result.steps.find((step) => step.id === "hunter");
  assert.equal(hunter?.status, "skipped");
});
