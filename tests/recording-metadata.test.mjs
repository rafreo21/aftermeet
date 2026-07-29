import assert from "node:assert/strict";
import test from "node:test";

import {
  CLOUD_RECORDING_RETENTION_DAYS,
  cloudExpiresAt,
  hasActiveCloudRecording,
  isCloudRecordingExpired,
  mergeRecordingMetadataForSave,
} from "../lib/recording-metadata.ts";

test("cloud retention is 10 days", () => {
  assert.equal(CLOUD_RECORDING_RETENTION_DAYS, 10);
});

test("cloudExpiresAt adds 10 days", () => {
  const start = new Date("2026-07-01T12:00:00.000Z");
  assert.equal(cloudExpiresAt(start), "2026-07-11T12:00:00.000Z");
});

test("isCloudRecordingExpired respects cloudExpiresAt", () => {
  assert.equal(
    isCloudRecordingExpired({ cloudExpiresAt: "2026-01-01T00:00:00.000Z" }, Date.parse("2026-02-01")),
    true,
  );
  assert.equal(
    isCloudRecordingExpired({ cloudExpiresAt: "2026-12-01T00:00:00.000Z" }, Date.parse("2026-02-01")),
    false,
  );
});

test("mergeRecordingMetadataForSave preserves cloud upload fields", () => {
  const merged = mergeRecordingMetadataForSave(
    {
      durationSeconds: 42,
      mimeType: "audio/wav",
      audioLocation: "user_device",
      retention: "7_days",
    },
    {
      durationSeconds: 40,
      mimeType: "audio/mp4",
      audioLocation: "server",
      storagePath: "workspace/encounter-id.m4a",
      sharedAudioUrl: "/api/encounters/share/token/recording",
      cloudExpiresAt: "2026-08-01T00:00:00.000Z",
    },
  );

  assert.equal(merged?.audioLocation, "server");
  assert.equal(merged?.storagePath, "workspace/encounter-id.m4a");
  assert.equal(merged?.sharedAudioUrl, "/api/encounters/share/token/recording");
  assert.equal(merged?.cloudExpiresAt, "2026-08-01T00:00:00.000Z");
  assert.equal(merged?.durationSeconds, 42);
});

test("hasActiveCloudRecording requires server path and unexpired window", () => {
  assert.equal(
    hasActiveCloudRecording({
      audioLocation: "server",
      storagePath: "a/b.m4a",
      cloudExpiresAt: "2026-12-01T00:00:00.000Z",
    }, Date.parse("2026-07-01")),
    true,
  );
  assert.equal(
    hasActiveCloudRecording({
      audioLocation: "server",
      storagePath: "a/b.m4a",
      cloudExpiresAt: "2026-01-01T00:00:00.000Z",
    }, Date.parse("2026-07-01")),
    false,
  );
});
