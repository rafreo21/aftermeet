import assert from "node:assert/strict";
import test from "node:test";

import { isSupportedAudioFile } from "../lib/audio-file.ts";

test("accepts ordinary audio MIME types", () => {
  assert.equal(isSupportedAudioFile({ name: "meeting.m4a", type: "audio/mp4" }), true);
});

test("accepts audio-only WebM files Chromium labels as video", () => {
  assert.equal(isSupportedAudioFile({ name: "meeting.webm", type: "video/webm" }), true);
});

test("uses known audio extensions when a browser omits the MIME type", () => {
  assert.equal(isSupportedAudioFile({ name: "meeting.WEBM", type: "" }), true);
});

test("rejects unrelated files", () => {
  assert.equal(isSupportedAudioFile({ name: "meeting.pdf", type: "application/pdf" }), false);
});
