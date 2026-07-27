import test from "node:test";
import assert from "node:assert/strict";

import { applyExtractionDraft, buildHeuristicDraft } from "../lib/encounter-extraction.ts";

const websiteTranscript =
  "Yeah so today we are trying to make things work The website is supposed to work on all we are supposed to fix the website London paint section about page and also answer to the address page I'm here with Sarah Myself and Sarah are supposed to fix this and lead designer on this particular project she has support for this to make it work out perfectly my own side I'm just going to provide like design that's why she does like the direction right thank you";

test("buildHeuristicDraft extracts a person and follow-up channel", () => {
  const draft = buildHeuristicDraft(
    "Hi, my name is Sarah Chen. We discussed the pilot rollout. I'll email you the deck next week.",
    "",
    { ownerNames: ["Alex Morgan"] },
  );

  assert.ok(draft);
  assert.match(draft.title, /Sarah Chen/);
  assert.equal(draft.personName, "Sarah Chen");
  assert.equal(draft.followUpType, "email");
  assert.match(draft.sharedSummary, /We discussed/i);
});

test("buildHeuristicDraft handles run-on speech about website work with Sarah", () => {
  const draft = buildHeuristicDraft(websiteTranscript, "", { ownerNames: ["Raf"] });
  assert.ok(draft);
  assert.equal(draft.personName, "Sarah");
  assert.match(draft.title, /Sarah/);
  assert.match(draft.sharedSummary, /Sarah|We discussed/i);
  assert.match(draft.sharedSummary, /London paint section|about page|address page|website/i);
  assert.match(draft.privateNotes, /Sarah/);
  assert.doesNotMatch(draft.privateNotes, /My contribution/i);
  assert.match(draft.followUp, /London paint section|about page|address page|Sarah/i);
  assert.doesNotMatch(draft.personName, /here with/i);
});

test("buildHeuristicDraft keeps owner name out of personName", () => {
  const draft = buildHeuristicDraft(
    "I'm Raf and I'm here with Jordan Lee. Jordan needs the proposal by Friday.",
    "",
    { ownerNames: ["Raf"] },
  );
  assert.ok(draft);
  assert.equal(draft.personName, "Jordan Lee");
  assert.match(draft.privateNotes, /Jordan|Friday/i);
});

test("applyExtractionDraft only fills empty fields", () => {
  const next = applyExtractionDraft(
    {
      title: "Existing title",
      personName: "",
      privateNotes: "",
      sharedSummary: "",
      followUp: "",
      followUpType: "call",
    },
    {
      title: "Draft title",
      personName: "Alex",
      sharedSummary: "Summary",
      privateNotes: "Notes",
      followUp: "Send intro",
      followUpType: "email",
    },
  );

  assert.equal(next.title, "Existing title");
  assert.equal(next.personName, "Alex");
  assert.equal(next.followUpType, "email");
});
