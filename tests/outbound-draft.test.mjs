import test from "node:test";
import assert from "node:assert/strict";

import { buildHeuristicOutboundDraft, composeLinksForDraft } from "../lib/outbound-draft.ts";

test("buildHeuristicOutboundDraft creates email follow-up with subject and greeting", () => {
  const draft = buildHeuristicOutboundDraft(
    { title: "Send the deck", channel: "email" },
    { title: "Coffee chat", sharedSummary: "We discussed the pilot timeline.", privateNotes: "Internal only" },
    { personName: "Sarah Chen", personEmail: "sarah@example.com", encounterTitle: "Coffee chat" },
  );

  assert.match(draft.subject, /Coffee chat/);
  assert.match(draft.body, /Hi Sarah,/);
  assert.match(draft.body, /Send the deck/);
  assert.doesNotMatch(draft.body, /Internal only/);
});

test("buildHeuristicOutboundDraft leaves LinkedIn subject empty", () => {
  const draft = buildHeuristicOutboundDraft(
    { title: "Connect on LinkedIn", channel: "linkedin" },
    { title: "Summit booth", sharedSummary: "", privateNotes: "" },
    { personName: "Alex Kim", personEmail: "", encounterTitle: "Summit booth" },
  );

  assert.equal(draft.subject, "");
  assert.match(draft.body, /Hi Alex,/);
});

test("composeLinksForDraft builds Gmail compose URL with draft content", () => {
  const links = composeLinksForDraft(
    { channel: "email" },
    { subject: "Following up", body: "Thanks again for your time." },
    { personName: "Sarah Chen", personEmail: "sarah@example.com", encounterTitle: "Coffee chat" },
  );

  assert.equal(links.length, 3);
  assert.match(links[0].href, /mail\.google\.com/);
  assert.match(links[0].href, /sarah%40example\.com|to=sarah/);
});
