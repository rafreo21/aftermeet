import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isActiveCaptureSession,
  transitionCaptureSession,
} from '../mobile/src/features/encounters/capture-session-state.ts';

describe('capture session state machine', () => {
  it('supports the complete record, pause, process, review, and save lifecycle', () => {
    let status = 'draft';
    status = transitionCaptureSession(status, 'start');
    assert.equal(status, 'recording');
    status = transitionCaptureSession(status, 'pause');
    assert.equal(status, 'paused');
    status = transitionCaptureSession(status, 'resume');
    assert.equal(status, 'recording');
    status = transitionCaptureSession(status, 'finish');
    assert.equal(status, 'processing');
    status = transitionCaptureSession(status, 'process_complete');
    assert.equal(status, 'review_ready');
    status = transitionCaptureSession(status, 'save');
    assert.equal(status, 'saved');
  });

  it('keeps invalid transitions impossible', () => {
    assert.equal(transitionCaptureSession('draft', 'save'), 'draft');
    assert.equal(transitionCaptureSession('recording', 'save'), 'recording');
    assert.equal(transitionCaptureSession('processing', 'pause'), 'processing');
    assert.equal(transitionCaptureSession('saved', 'retry'), 'saved');
    assert.equal(transitionCaptureSession('saved', 'reset'), 'saved');
  });

  it('recovers a failed processing session without reopening recording', () => {
    assert.equal(transitionCaptureSession('processing', 'process_failed'), 'failed');
    assert.equal(transitionCaptureSession('failed', 'retry'), 'processing');
  });

  it('only treats recording, paused, and processing sessions as active', () => {
    assert.equal(isActiveCaptureSession('recording'), true);
    assert.equal(isActiveCaptureSession('paused'), true);
    assert.equal(isActiveCaptureSession('processing'), true);
    assert.equal(isActiveCaptureSession('draft'), false);
    assert.equal(isActiveCaptureSession('review_ready'), false);
    assert.equal(isActiveCaptureSession('saved'), false);
    assert.equal(isActiveCaptureSession('failed'), false);
  });
});
