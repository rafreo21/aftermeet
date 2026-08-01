import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyRecordingUploadError, classifyTranscriptionError } from "../lib/capture-errors.ts";

describe("capture error classification", () => {
  it("turns provider quota failures into a safe, retryable transcription state", () => {
    const failure = classifyTranscriptionError(new Error("insufficient_quota: billing limit reached"));
    assert.equal(failure.code, "transcription_quota");
    assert.equal(failure.retryable, true);
    assert.match(failure.error, /recording is safe/i);
  });

  it("marks unsupported audio as actionable and non-retryable", () => {
    const failure = classifyTranscriptionError(new Error("invalid audio format: decode failed"));
    assert.equal(failure.code, "audio_unsupported");
    assert.equal(failure.status, 415);
    assert.equal(failure.retryable, false);
    assert.match(failure.error, /M4A, MP3, WAV, or WebM/);
  });

  it("distinguishes full cloud storage from a temporary upload failure", () => {
    const full = classifyRecordingUploadError(new Error("storage quota exceeded"));
    assert.equal(full.code, "recording_storage_full");
    assert.equal(full.retryable, false);

    const temporary = classifyRecordingUploadError(new Error("socket disconnected"));
    assert.equal(temporary.code, "recording_upload_failed");
    assert.equal(temporary.retryable, true);
    assert.match(temporary.error, /local copy is safe/i);
  });
});
