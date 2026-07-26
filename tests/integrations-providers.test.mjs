import test from "node:test";
import assert from "node:assert/strict";

import { buildPlainEmailRaw, parseScopes } from "../lib/integrations/email.ts";

test("buildPlainEmailRaw encodes a MIME message", () => {
  const raw = buildPlainEmailRaw("sarah@example.com", "Following up", "Hi Sarah,\n\nThanks again.");
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(decoded, /To: sarah@example.com/);
  assert.match(decoded, /Subject: Following up/);
  assert.match(decoded, /Thanks again\./);
});

test("parseScopes splits oauth scope strings", () => {
  assert.deepEqual(parseScopes("Mail.Send Calendars.ReadWrite"), ["Mail.Send", "Calendars.ReadWrite"]);
});
