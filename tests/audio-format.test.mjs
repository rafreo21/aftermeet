import assert from "node:assert/strict";
import test from "node:test";

import { audioFileExtension, detectAudioMimeType } from "../lib/audio-format.ts";

test("detects an MP4/M4A container even when declared as audio/mpeg", () => {
  const bytes = Uint8Array.from([
    0, 0, 0, 24,
    ...Buffer.from("ftyp"),
    ...Buffer.from("mp42"),
  ]);
  assert.equal(detectAudioMimeType(bytes, "audio/mpeg"), "audio/mp4");
  assert.equal(audioFileExtension("audio/mp4"), "m4a");
});

test("keeps genuine MP3 and WebM formats", () => {
  assert.equal(detectAudioMimeType(Uint8Array.from(Buffer.from("ID3abc")), ""), "audio/mpeg");
  assert.equal(detectAudioMimeType(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), ""), "audio/webm");
  assert.equal(audioFileExtension("audio/webm"), "webm");
});
