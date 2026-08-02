import assert from "node:assert/strict";
import test from "node:test";

import {
  encounterMatchesConnection,
  encountersForConnection,
  flattenOpenFollowUps,
  followUpsForConnection,
} from "../lib/follow-ups-server.ts";

const encounter = {
  id: "meeting-1",
  title: "Team coffee",
  personName: "Sarah Chen, James Cole",
  personEmail: "sarah@example.com",
  contactId: "contact-sarah",
  exchangeId: "exchange-sarah",
  startedAt: "2026-08-01T09:00:00.000Z",
  endedAt: "2026-08-01T09:30:00.000Z",
  durationSeconds: 1800,
  consent: { confirmed: true, method: "verbal", confirmedAt: "2026-08-01T09:00:00.000Z" },
  transcript: "",
  privateNotes: "",
  sharedSummary: "",
  actions: [],
  participants: [
    { id: "participant-sarah", name: "Sarah Chen", email: "sarah@example.com", phone: "", linkedIn: "", exchangeId: "exchange-sarah" },
    { id: "participant-james", name: "James Cole", email: "james@example.com", phone: "", linkedIn: "", exchangeId: "exchange-james" },
  ],
  status: "reviewed",
  shareToken: "share-1",
};

test("encounter matching includes a secondary participant by email", () => {
  assert.equal(encounterMatchesConnection(encounter, { email: " JAMES@example.com " }), true);
  assert.deepEqual(encountersForConnection([encounter], { email: "james@example.com" }), [encounter]);
});

test("encounter matching includes a secondary participant by exchange or participant id", () => {
  assert.equal(encounterMatchesConnection(encounter, { exchangeId: "exchange-james" }), true);
  assert.equal(encounterMatchesConnection(encounter, { sourceId: "participant-james" }), true);
  assert.equal(encounterMatchesConnection(encounter, { sourceId: "exchange-james" }), true);
});

test("targeted follow-ups do not leak between people from the same encounter", () => {
  const base = {
    encounterId: encounter.id,
    groupId: undefined,
    channel: "email",
    dueAt: "2026-08-04",
    status: "open",
    owner: "me",
    participants: encounter.participants,
    contactId: encounter.contactId,
    exchangeId: encounter.exchangeId,
    encounterTitle: encounter.title,
    startedAt: encounter.startedAt,
  };
  const items = [
    { ...base, actionId: "sarah-action", title: "Email Sarah", personName: "Sarah Chen", personEmail: "sarah@example.com", participantId: "participant-sarah" },
    { ...base, actionId: "james-action", title: "Call James", personName: "James Cole", personEmail: "james@example.com", participantId: "participant-james" },
  ];

  assert.deepEqual(
    followUpsForConnection(items, { email: "james@example.com", exchangeId: "exchange-james" }).map((item) => item.actionId),
    ["james-action"],
  );
});

test("follow-ups stay pending until the encounter has been reviewed", () => {
  const action = {
    id: "action-1",
    title: "Send the proposal",
    channel: "email",
    owner: "me",
    dueAt: "2026-08-04",
    status: "open",
  };
  const draftEncounter = { ...encounter, status: "draft", actions: [action] };
  const reviewedEncounter = { ...encounter, status: "reviewed", actions: [action] };
  const sharedEncounter = { ...encounter, status: "shared", actions: [action] };

  assert.deepEqual(flattenOpenFollowUps([draftEncounter]), []);
  assert.deepEqual(flattenOpenFollowUps([reviewedEncounter]).map((item) => item.actionId), ["action-1"]);
  assert.deepEqual(flattenOpenFollowUps([sharedEncounter]).map((item) => item.actionId), ["action-1"]);
});
