import test from "node:test";
import assert from "node:assert/strict";

import { buildActionLinkContext, channelLabel, resolveActionLink } from "../lib/action-links.ts";

test("resolveActionLink builds tel link when phone is present", () => {
  const link = resolveActionLink(
    { channel: "call", title: "Call about the pilot", dueAt: "" },
    { personName: "Sarah Chen", personEmail: "sarah@example.com", phone: "+44 7700 900123" },
  );

  assert.equal(link.label, "Call");
  assert.equal(link.href, "tel:+447700900123");
});

test("resolveActionLink opens LinkedIn profile or search fallback", () => {
  const withProfile = resolveActionLink(
    { channel: "linkedin", title: "Connect on LinkedIn", dueAt: "" },
    { personName: "Sarah Chen", personEmail: "", linkedinUrl: "linkedin.com/in/sarahchen" },
  );
  assert.match(withProfile.href, /linkedin\.com\/in\/sarahchen/);

  const fallback = resolveActionLink(
    { channel: "linkedin", title: "Connect on LinkedIn", dueAt: "" },
    { personName: "Sarah Chen", personEmail: "" },
  );
  assert.match(fallback.href, /linkedin\.com\/search/);
});

test("buildActionLinkContext prefers linked contact details", () => {
  const context = buildActionLinkContext(
    { personName: "Sarah", personEmail: "", title: "Coffee chat" },
    {
      id: "1",
      firstName: "Sarah",
      lastName: "Chen",
      email: "sarah@example.com",
      phone: "5551234",
      company: "",
      role: "",
      context: "",
    },
  );

  assert.equal(context.personEmail, "sarah@example.com");
  assert.equal(context.phone, "5551234");
  assert.equal(channelLabel("email"), "Email");
});
