import test from "node:test";
import assert from "node:assert/strict";

import { cleanLiveTranscript } from "../lib/transcript-cleanup.ts";

test("cleanLiveTranscript removes repeated words and duplicate sentences", () => {
  const cleaned = cleanLiveTranscript(
    "We we should follow up. We should follow up. I I will send the deck tomorrow.",
  );
  assert.equal(cleaned, "We should follow up. I will send the deck tomorrow.");
});
