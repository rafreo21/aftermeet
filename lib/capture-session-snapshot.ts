export const CAPTURE_SESSION_HEARTBEAT_TIMEOUT_MS = 90_000;

const ACTIVE_CAPTURE_STATUSES = new Set([
  "draft",
  "recording",
  "paused",
  "processing",
  "review_ready",
  "failed",
]);

const CAPTURE_SESSION_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(["draft", "recording", "review_ready", "failed"]),
  recording: new Set(["recording", "paused", "processing", "review_ready", "failed"]),
  paused: new Set(["paused", "recording", "processing", "review_ready", "failed"]),
  processing: new Set(["processing", "review_ready", "failed"]),
  review_ready: new Set(["review_ready", "recording", "processing", "failed"]),
  failed: new Set(["failed", "draft", "recording", "review_ready"]),
};

type CaptureSessionSnapshot = Record<string, unknown> & {
  encounterId: string;
  sessionStatus: string;
  durationSeconds: number;
  step: number;
  updatedAt: string;
};

export function isCaptureSessionTransitionAllowed(from: unknown, to: unknown) {
  if (typeof to !== "string" || !ACTIVE_CAPTURE_STATUSES.has(to)) return false;
  if (typeof from !== "string" || !ACTIVE_CAPTURE_STATUSES.has(from)) return true;
  return CAPTURE_SESSION_TRANSITIONS[from]?.has(to) ?? false;
}

export function normalizeCaptureSessionSnapshot(
  input: unknown,
  now = new Date(),
): CaptureSessionSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.encounterId !== "string" || !value.encounterId.trim()) return null;
  const status = typeof value.sessionStatus === "string" && ACTIVE_CAPTURE_STATUSES.has(value.sessionStatus)
    ? value.sessionStatus
    : "draft";

  return {
    ...value,
    encounterId: value.encounterId.trim(),
    sessionStatus: status,
    durationSeconds: typeof value.durationSeconds === "number"
      ? Math.max(0, Math.round(value.durationSeconds))
      : 0,
    step: typeof value.step === "number" ? Math.max(0, Math.min(3, Math.round(value.step))) : 0,
    failureReason: status === "failed" && typeof value.failureReason === "string"
      ? value.failureReason.trim().slice(0, 120)
      : undefined,
    recordingStoppedAt: status === "failed" && typeof value.recordingStoppedAt === "string"
      ? value.recordingStoppedAt
      : undefined,
    updatedAt: now.toISOString(),
  };
}

export function expireStaleCaptureSession(
  input: unknown,
  now = new Date(),
): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  const snapshot = input as Record<string, unknown>;
  const status = snapshot.sessionStatus;
  if (status !== "recording" && status !== "paused") return snapshot;

  const updatedAt = typeof snapshot.updatedAt === "string" ? Date.parse(snapshot.updatedAt) : Number.NaN;
  if (Number.isFinite(updatedAt) && now.getTime() - updatedAt <= CAPTURE_SESSION_HEARTBEAT_TIMEOUT_MS) {
    return snapshot;
  }

  return {
    ...snapshot,
    sessionStatus: "failed",
    failureReason: "recording_heartbeat_lost",
    recordingStoppedAt: typeof snapshot.recordingStoppedAt === "string" && snapshot.recordingStoppedAt
      ? snapshot.recordingStoppedAt
      : now.toISOString(),
  };
}
