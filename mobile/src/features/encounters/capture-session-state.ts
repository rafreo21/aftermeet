export type CaptureSessionStatus =
  | 'draft'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'review_ready'
  | 'saved'
  | 'failed';

export type CaptureSessionEvent =
  | 'start'
  | 'pause'
  | 'resume'
  | 'finish'
  | 'process_complete'
  | 'process_failed'
  | 'retry'
  | 'save'
  | 'reset';

const TRANSITIONS: Record<CaptureSessionStatus, Partial<Record<CaptureSessionEvent, CaptureSessionStatus>>> = {
  draft: { start: 'recording', reset: 'draft' },
  recording: { pause: 'paused', finish: 'processing', process_failed: 'failed', reset: 'draft' },
  paused: { resume: 'recording', finish: 'processing', process_failed: 'failed', reset: 'draft' },
  processing: { process_complete: 'review_ready', process_failed: 'failed', reset: 'draft' },
  review_ready: { retry: 'processing', save: 'saved', reset: 'draft' },
  failed: { retry: 'processing', reset: 'draft' },
  saved: {},
};

export function transitionCaptureSession(
  current: CaptureSessionStatus,
  event: CaptureSessionEvent,
): CaptureSessionStatus {
  return TRANSITIONS[current][event] ?? current;
}

export function isActiveCaptureSession(status: CaptureSessionStatus) {
  return status === 'recording' || status === 'paused' || status === 'processing';
}
