import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CAPTURE_SESSION_HEARTBEAT_TIMEOUT_MS,
  expireStaleCaptureSession,
  isCaptureSessionTransitionAllowed,
  normalizeCaptureSessionSnapshot,
} from '../lib/capture-session-snapshot.ts';

describe('capture session snapshots', () => {
  it('normalizes untrusted client snapshots', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    const snapshot = normalizeCaptureSessionSnapshot({
      encounterId: '  encounter-1  ',
      sessionStatus: 'recording',
      durationSeconds: 12.6,
      step: 99,
    }, now);

    assert.equal(snapshot?.encounterId, 'encounter-1');
    assert.equal(snapshot?.durationSeconds, 13);
    assert.equal(snapshot?.step, 3);
    assert.equal(snapshot?.updatedAt, now.toISOString());
  });

  it('keeps a recent recording active', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    const snapshot = expireStaleCaptureSession({
      encounterId: 'encounter-1',
      sessionStatus: 'recording',
      updatedAt: new Date(now.getTime() - CAPTURE_SESSION_HEARTBEAT_TIMEOUT_MS + 1).toISOString(),
    }, now);

    assert.equal(snapshot?.sessionStatus, 'recording');
  });

  it('clears stale interruption metadata when recording resumes', () => {
    const snapshot = normalizeCaptureSessionSnapshot({
      encounterId: 'encounter-1',
      sessionStatus: 'recording',
      failureReason: 'recording_heartbeat_lost',
      recordingStoppedAt: '2026-08-01T11:58:00.000Z',
    }, new Date('2026-08-01T12:00:00.000Z'));

    assert.equal(snapshot?.sessionStatus, 'recording');
    assert.equal(snapshot?.failureReason, undefined);
    assert.equal(snapshot?.recordingStoppedAt, undefined);
  });

  it('turns an abandoned recording into a recoverable failed draft', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    const snapshot = expireStaleCaptureSession({
      encounterId: 'encounter-1',
      sessionStatus: 'paused',
      updatedAt: new Date(now.getTime() - CAPTURE_SESSION_HEARTBEAT_TIMEOUT_MS - 1).toISOString(),
    }, now);

    assert.equal(snapshot?.sessionStatus, 'failed');
    assert.equal(snapshot?.failureReason, 'recording_heartbeat_lost');
    assert.equal(snapshot?.recordingStoppedAt, now.toISOString());
  });

  it('does not expire processing or review states', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    const stale = new Date('2026-07-01T12:00:00.000Z').toISOString();

    assert.equal(expireStaleCaptureSession({ sessionStatus: 'processing', updatedAt: stale }, now)?.sessionStatus, 'processing');
    assert.equal(expireStaleCaptureSession({ sessionStatus: 'review_ready', updatedAt: stale }, now)?.sessionStatus, 'review_ready');
  });

  it('prevents stale devices from downgrading active or review-ready work', () => {
    assert.equal(isCaptureSessionTransitionAllowed('recording', 'draft'), false);
    assert.equal(isCaptureSessionTransitionAllowed('review_ready', 'draft'), false);
    assert.equal(isCaptureSessionTransitionAllowed('processing', 'recording'), false);
  });

  it('allows deliberate recovery and normal capture progress', () => {
    assert.equal(isCaptureSessionTransitionAllowed('draft', 'recording'), true);
    assert.equal(isCaptureSessionTransitionAllowed('recording', 'paused'), true);
    assert.equal(isCaptureSessionTransitionAllowed('paused', 'recording'), true);
    assert.equal(isCaptureSessionTransitionAllowed('recording', 'processing'), true);
    assert.equal(isCaptureSessionTransitionAllowed('processing', 'review_ready'), true);
    assert.equal(isCaptureSessionTransitionAllowed('failed', 'recording'), true);
  });
});
