import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createEmptyDiscoveryData,
  DISCOVERY_SCHEMA_VERSION,
  DISCOVERY_STORAGE_KEY,
  getDiscoveryCounts,
  initialHypotheses,
  parseDiscoveryData,
} from "../app/hub/discovery/discovery-data.ts";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("creates a versioned empty discovery workspace", () => {
  const data = createEmptyDiscoveryData("2026-07-24");
  assert.equal(DISCOVERY_STORAGE_KEY, "aftermeet-customer-discovery-v1");
  assert.equal(data.version, DISCOVERY_SCHEMA_VERSION);
  assert.equal(data.hypotheses.length, 9);
  assert.equal(initialHypotheses[0].id, "HYP-001");
  assert.deepEqual(getDiscoveryCounts(data), { recruited: 0, scheduled: 0, completed: 0, analysed: 0 });
});

test("round-trips valid discovery data and rejects outdated or malformed data", () => {
  const source = createEmptyDiscoveryData("2026-07-24");
  source.participants.push({
    id: "participant-1",
    referenceId: "P-01",
    name: "Fictional participant",
    professionalCategory: "strategy_operations",
    yearsIndependent: "4",
    meetingsPerWeek: "5",
    currentTools: "Notes and email",
    recruitmentSource: "Referral",
    recruitmentStatus: "completed",
    interviewDateTime: "2026-07-24T10:00",
    consentConfirmed: true,
    interviewStatus: "completed",
    notes: "",
  });
  const parsed = parseDiscoveryData(JSON.stringify(source));
  assert.equal(parsed.participants[0].referenceId, "P-01");
  assert.throws(() => parseDiscoveryData("{}"), /not a supported/);
  assert.throws(() => parseDiscoveryData(JSON.stringify({ version: 0, participants: [], interviews: [], evidence: [] })), /not a supported/);
  assert.throws(() => parseDiscoveryData(JSON.stringify({ version: 1 })), /missing required/);
});

test("counts recruited, scheduled, completed, and analysed independently", () => {
  const data = createEmptyDiscoveryData("2026-07-24");
  data.participants = [
    { id: "p1", referenceId: "P-01", name: "", professionalCategory: "other", yearsIndependent: "", meetingsPerWeek: "", currentTools: "", recruitmentSource: "", recruitmentStatus: "scheduled", interviewDateTime: "", consentConfirmed: false, interviewStatus: "scheduled", notes: "" },
    { id: "p2", referenceId: "P-02", name: "", professionalCategory: "other", yearsIndependent: "", meetingsPerWeek: "", currentTools: "", recruitmentSource: "", recruitmentStatus: "contacted", interviewDateTime: "", consentConfirmed: false, interviewStatus: "not_scheduled", notes: "" },
  ];
  data.interviews = [{
    id: "i1", participantId: "p1", interviewDate: "2026-07-24", interviewer: "Researcher", duration: "30 minutes", consentState: "confirmed", recordingReference: "", lastImportantMeeting: "", currentWorkflow: "", toolsUsed: "", followUpMethod: "", failureExample: "", frequency: "", consequence: "", existingWorkaround: "", paymentEvidence: "", verbatimQuote: "", observedBehaviour: "", researcherInterpretation: "", contradictoryEvidence: "", followUpQuestions: "", overallEvidenceStrength: "medium", analysed: true,
  }];
  assert.deepEqual(getDiscoveryCounts(data), { recruited: 2, scheduled: 1, completed: 1, analysed: 1 });
});

test("server-renders the hub and discovery routes", async () => {
  const [hub, discovery] = await Promise.all([render("/hub"), render("/hub/discovery")]);
  assert.equal(hub.status, 200);
  assert.equal(discovery.status, 200);
  const hubHtml = await hub.text();
  const discoveryHtml = await discovery.text();
  assert.match(hubHtml, /Status distribution/);
  assert.doesNotMatch(hubHtml, /Evidence-weighted maturity/);
  assert.match(discoveryHtml, /Customer discovery workspace/);
  assert.match(discoveryHtml, /Browser-local prototype/);
  assert.match(discoveryHtml, /Unvalidated assumptions/);
});

test("discovery documentation and route use the governed research language", async () => {
  const [plan, template, page] = await Promise.all([
    readFile(new URL("../docs/product/04-customer-discovery-plan.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/product/05-interview-template.md", import.meta.url), "utf8"),
    readFile(new URL("../app/hub/discovery/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(plan, /HYP-009/);
  assert.match(plan, /manual/i);
  assert.match(template, /What the participant demonstrated/);
  assert.match(page, /Delete all discovery data/);
  assert.match(page, /Export JSON/);
  assert.match(page, /Import JSON/);
});
