import test from "node:test";
import assert from "node:assert/strict";

import {
  encounterOnServer,
  mergeEncounterRows,
  sortEncounters,
} from "../lib/encounter-list-sync.ts";

const baseEncounter = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Coffee chat",
  personName: "Sarah Chen",
  personEmail: "sarah@example.com",
  startedAt: "2026-07-20T10:00:00.000Z",
  endedAt: "2026-07-20T10:30:00.000Z",
  durationSeconds: 1800,
  consent: {
    confirmed: true,
    method: "verbal",
    confirmedAt: "2026-07-20T10:00:00.000Z",
    scriptVersion: "2026-07-26",
  },
  transcript: "",
  privateNotes: "",
  sharedSummary: "",
  actions: [],
  status: "draft",
  shareToken: "abc123",
};

test("encounterOnServer matches by encounter id", () => {
  assert.equal(encounterOnServer(baseEncounter, [baseEncounter]), true);
  assert.equal(encounterOnServer(baseEncounter, []), false);
});

test("mergeEncounterRows keeps local recording metadata when server row lacks it", () => {
  const local = {
    ...baseEncounter,
    recording: {
      durationSeconds: 120,
      fileSize: 4096,
      mimeType: "audio/webm",
      source: "recorded",
      retention: "7_days",
      expiresAt: null,
      createdAt: "2026-07-20T10:00:00.000Z",
    },
  };
  const merged = mergeEncounterRows(baseEncounter, local);
  assert.equal(merged.recording?.mimeType, "audio/webm");
  assert.equal(merged.title, baseEncounter.title);
});

test("sortEncounters orders newest startedAt first", () => {
  const sorted = sortEncounters([
    { ...baseEncounter, id: "1", startedAt: "2026-07-01T10:00:00.000Z" },
    { ...baseEncounter, id: "2", startedAt: "2026-07-25T10:00:00.000Z" },
  ]);
  assert.equal(sorted[0]?.id, "2");
});
