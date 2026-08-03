import assert from "node:assert/strict";
import test from "node:test";

import { detectEncounterConflict } from "../lib/encounter-conflict.ts";

test("no conflict when the caller does not send an expected timestamp", () => {
  assert.equal(detectEncounterConflict("2026-08-03T10:00:00.000Z", undefined), false);
  assert.equal(detectEncounterConflict("2026-08-03T10:00:00.000Z", ""), false);
});

test("no conflict on a brand-new row with nothing stored yet", () => {
  assert.equal(detectEncounterConflict(null, "2026-08-03T10:00:00.000Z"), false);
  assert.equal(detectEncounterConflict(undefined, "2026-08-03T10:00:00.000Z"), false);
});

test("no conflict when the expected timestamp matches the stored one", () => {
  assert.equal(detectEncounterConflict("2026-08-03T10:00:00.000Z", "2026-08-03T10:00:00.000Z"), false);
});

test("conflict when another write landed since the caller last read the row", () => {
  assert.equal(detectEncounterConflict("2026-08-03T10:05:00.000Z", "2026-08-03T10:00:00.000Z"), true);
});
