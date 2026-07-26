import test from "node:test";
import assert from "node:assert/strict";

import { buildLinkedInImportInitialState, decodeCaptureParam } from "../lib/linkedin-import-state.ts";

test("decodeCaptureParam round-trips extension payloads", () => {
  const payload = {
    firstName: "Raphael",
    lastName: "Okojie",
    role: "Product Designer",
    company: "Nexleaf Analytics",
    email: "rafreo21@gmail.com",
    phone: "+447473177720",
    linkedinUrl: "https://www.linkedin.com/in/rafreo",
    sourceUrl: "https://www.linkedin.com/in/rafreo",
    source: "extension",
    context: "Current role: Product Designer at Nexleaf Analytics. Email visible on LinkedIn: rafreo21@gmail.com.",
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const decoded = decodeCaptureParam(encoded);
  assert.equal(decoded?.firstName, "Raphael");
  assert.equal(decoded?.company, "Nexleaf Analytics");
});

test("buildLinkedInImportInitialState hydrates extension capture on the server", () => {
  const payload = {
    firstName: "Raphael",
    lastName: "Okojie",
    role: "Product Designer",
    company: "Nexleaf Analytics",
    email: "rafreo21@gmail.com",
    phone: "+447473177720",
    linkedinUrl: "https://www.linkedin.com/in/rafreo",
    sourceUrl: "https://www.linkedin.com/in/rafreo",
    source: "extension",
    context: "Current role: Product Designer at Nexleaf Analytics. Email visible on LinkedIn: rafreo21@gmail.com.",
  };
  const capture = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const initial = buildLinkedInImportInitialState({
    url: "https://www.linkedin.com/in/rafreo",
    capture,
    source: "extension",
  });

  assert.equal(initial.input, "https://www.linkedin.com/in/rafreo");
  assert.equal(initial.form.role, "Product Designer");
  assert.equal(initial.form.company, "Nexleaf Analytics");
  assert.match(initial.form.context, /Current role: Product Designer at Nexleaf Analytics/);
  assert.equal(initial.lookupStatus, "ready");
  assert.equal(initial.isExtensionImport, true);
});
