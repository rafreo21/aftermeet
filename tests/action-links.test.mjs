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

test("buildActionLinkContext targets an action's assigned participant", () => {
  const context = buildActionLinkContext(
    {
      personName: "Sarah Chen",
      personEmail: "sarah@example.com",
      title: "Product dinner",
      participants: [
        {
          id: "participant-james",
          name: "James Okafor",
          email: "james@example.com",
          phone: "+44 7700 900456",
          linkedIn: "linkedin.com/in/james-okafor",
        },
      ],
    },
    {
      firstName: "Sarah",
      lastName: "Chen",
      email: "sarah@example.com",
      phone: "+44 7700 900123",
      instagramUrl: "@sarahchen",
    },
    { participantId: "participant-james" },
  );

  assert.equal(context.personName, "James Okafor");
  assert.equal(context.personEmail, "james@example.com");
  assert.equal(context.phone, "+44 7700 900456");
  assert.equal(context.linkedinUrl, "linkedin.com/in/james-okafor");
  assert.equal(context.instagramUrl, undefined);
});

test("resolveActionLink opens each saved social profile instead of falling back to email", () => {
  const context = {
    personName: "Sarah Chen",
    personEmail: "sarah@example.com",
    instagramUrl: "@sarahchen",
    xUrl: "sarah_x",
    tiktokUrl: "https://tiktok.com/@sarahchen",
  };

  assert.equal(resolveActionLink({ channel: "instagram", title: "Follow Sarah", dueAt: "" }, context).href, "https://instagram.com/sarahchen");
  assert.equal(resolveActionLink({ channel: "x", title: "Follow Sarah", dueAt: "" }, context).href, "https://x.com/sarah_x");
  assert.equal(resolveActionLink({ channel: "tiktok", title: "Follow Sarah", dueAt: "" }, context).href, "https://tiktok.com/@sarahchen");
  assert.equal(channelLabel("instagram"), "Instagram");
  assert.equal(channelLabel("x"), "X");
  assert.equal(channelLabel("tiktok"), "TikTok");
});

test("resolveActionLink explains when a required social profile is missing", () => {
  const link = resolveActionLink(
    { channel: "instagram", title: "Follow Sarah", dueAt: "" },
    { personName: "Sarah Chen", personEmail: "sarah@example.com" },
  );

  assert.equal(link.href, "");
  assert.match(link.unavailableReason, /Instagram profile/);
});
