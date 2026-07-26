import test from "node:test";
import assert from "node:assert/strict";

import { buildCampaignAttribution, buildWorkspaceAnalytics } from "../lib/campaign-analytics.ts";

const campaignId = "camp-1";
const contacts = [
  {
    id: "c1",
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex@example.com",
    company: "Northstar",
    role: "Consultant",
    context: "",
    source: "exchange",
    campaignId,
  },
  {
    id: "c2",
    firstName: "Jamie",
    lastName: "Lee",
    email: "jamie@example.com",
    company: "",
    role: "",
    context: "",
    source: "manual",
  },
];

const encounters = [
  {
    id: "e1",
    title: "Booth chat",
    personName: "Alex Morgan",
    personEmail: "alex@example.com",
    contactId: "c1",
    campaignId,
    startedAt: "2026-07-26T10:00:00.000Z",
    endedAt: "2026-07-26T10:20:00.000Z",
    durationSeconds: 1200,
    consent: {
      confirmed: true,
      method: "verbal",
      confirmedAt: "2026-07-26T10:00:00.000Z",
      scriptVersion: "2026-07-26",
    },
    transcript: "",
    privateNotes: "",
    sharedSummary: "",
    actions: [{
      id: "a1",
      title: "Send deck",
      channel: "email",
      owner: "me",
      dueAt: "",
      status: "completed",
    }],
    status: "reviewed",
    shareToken: "token",
  },
  {
    id: "e2",
    title: "Untagged coffee",
    personName: "Jamie Lee",
    personEmail: "jamie@example.com",
    contactId: "c2",
    startedAt: "2026-07-26T11:00:00.000Z",
    endedAt: "2026-07-26T11:10:00.000Z",
    durationSeconds: 600,
    consent: {
      confirmed: true,
      method: "verbal",
      confirmedAt: "2026-07-26T11:00:00.000Z",
      scriptVersion: "2026-07-26",
    },
    transcript: "",
    privateNotes: "",
    sharedSummary: "",
    actions: [],
    status: "draft",
    shareToken: "token2",
  },
];

test("buildCampaignAttribution counts people, captures, and follow-through", () => {
  const attribution = buildCampaignAttribution(campaignId, contacts, encounters);
  assert.equal(attribution.contacts, 1);
  assert.equal(attribution.captures, 1);
  assert.equal(attribution.completedFollowUps, 1);
  assert.equal(attribution.followThroughRate, 100);
  assert.equal(attribution.sources.exchange, 1);
});

test("buildWorkspaceAnalytics separates attributed and unattributed work", () => {
  const analytics = buildWorkspaceAnalytics(
    [{ id: campaignId, name: "SaaStr", location: "", startsAt: "", endsAt: "", notes: "", status: "active", createdAt: "" }],
    contacts,
    encounters,
  );
  assert.equal(analytics.totals.contacts, 2);
  assert.equal(analytics.campaigns[0].contacts, 1);
  assert.equal(analytics.unattributed.contacts, 1);
  assert.equal(analytics.unattributed.captures, 1);
});
