import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCameraConstraints,
  decodeQrFromImageData,
  prefersEnvironmentCamera,
} from "../lib/qr-camera-scan.ts";

test("prefersEnvironmentCamera is true on mobile user agents", () => {
  assert.equal(prefersEnvironmentCamera("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
  assert.equal(prefersEnvironmentCamera("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"), false);
});

test("buildCameraConstraints uses the front camera on desktop", () => {
  const constraints = buildCameraConstraints("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)");
  assert.deepEqual(constraints.video.facingMode, { ideal: "user" });
});

test("buildCameraConstraints prefers the rear camera on mobile", () => {
  const constraints = buildCameraConstraints("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
  assert.deepEqual(constraints.video.facingMode, { ideal: "environment" });
});

test("decodeQrFromImageData returns null for empty frames", () => {
  const data = new Uint8ClampedArray(16);
  assert.equal(decodeQrFromImageData(data, 4, 4), null);
});
