import type { CaptureSessionStatus } from '@/features/encounters/capture-session-state';

export type ActiveCaptureSnapshot = {
  encounterId: string;
  status: Extract<CaptureSessionStatus, 'recording' | 'paused' | 'processing'>;
  seconds: number;
};

type ActiveCaptureControls = {
  pauseOrResume: () => void | Promise<void>;
  finish: () => void | Promise<void>;
};

type ActiveCaptureController = ActiveCaptureControls & {
  snapshot: ActiveCaptureSnapshot;
};

let controller: ActiveCaptureController | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function registerActiveCaptureController(
  controls: ActiveCaptureControls,
  initialSnapshot: ActiveCaptureSnapshot,
) {
  const registered: ActiveCaptureController = {
    ...controls,
    snapshot: initialSnapshot,
  };
  controller = registered;
  emitChange();

  return () => {
    if (controller !== registered) return;
    controller = null;
    emitChange();
  };
}

export function updateActiveCaptureSnapshot(snapshot: ActiveCaptureSnapshot) {
  if (!controller || controller.snapshot.encounterId !== snapshot.encounterId) return;
  controller = { ...controller, snapshot };
  emitChange();
}

export function getActiveCaptureController() {
  return controller;
}

export function subscribeToActiveCapture(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

