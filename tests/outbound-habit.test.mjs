import test from "node:test";
import assert from "node:assert/strict";

import {
  isOutboundHabitProven,
  outboundHabitRequirement,
  supportsOutboundDraft,
} from "../lib/outbound-habit.ts";

test("supportsOutboundDraft covers email, send, and linkedin channels", () => {
  assert.equal(supportsOutboundDraft("email"), true);
  assert.equal(supportsOutboundDraft("send"), true);
  assert.equal(supportsOutboundDraft("linkedin"), true);
  assert.equal(supportsOutboundDraft("call"), false);
});

test("isOutboundHabitProven is false without browser storage", () => {
  assert.equal(isOutboundHabitProven(), false);
});

test("outboundHabitRequirement exposes review thresholds", () => {
  const requirement = outboundHabitRequirement();
  assert.equal(requirement.sentDrafts, 2);
  assert.equal(requirement.completedActions, 3);
});
