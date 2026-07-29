import { NativeModules, Platform } from 'react-native';

import { normalizeCardUrl } from '@/lib/nfc-ndef';

type HceSession = {
  setEnabled: (enabled: boolean) => Promise<void>;
  on: (event: string, listener: () => void) => () => void;
};

let activeSession: HceSession | null = null;
let readListenerCleanup: (() => void) | null = null;
let onReadCallback: (() => void) | null = null;

export const TAP_TO_SHARE_REBUILD_MESSAGE =
  'Tap to share needs a fresh Android build. Reinstall the dev app from your PC, then try again.';

export function isTapToShareNativeReady() {
  return Platform.OS === 'android' && Boolean((NativeModules as { Hce?: unknown }).Hce);
}

/** Android devices can tap to share once the native HCE module is in the installed build. */
export function isTapToShareSupported() {
  return Platform.OS === 'android';
}

export function isTapToShareActive() {
  return activeSession !== null;
}

export function setTapToShareReadListener(listener: (() => void) | null) {
  onReadCallback = listener;
}

export async function startTapToShare(cardUrl: string) {
  if (!isTapToShareSupported()) {
    throw new Error('Tap to share works on Android. On iPhone, use the QR code or Wallet pass.');
  }

  if (!isTapToShareNativeReady()) {
    throw new Error(TAP_TO_SHARE_REBUILD_MESSAGE);
  }

  const normalized = normalizeCardUrl(cardUrl);
  if (!normalized) {
    throw new Error('Publish your card first so we have a link to share.');
  }

  await stopTapToShare();

  const { HCESession, NFCTagType4, NFCTagType4NDEFContentType } = await import('react-native-hce');
  const tag = new NFCTagType4({
    type: NFCTagType4NDEFContentType.URL,
    content: normalized,
    writable: false,
  });

  const session = await HCESession.getInstance();

  readListenerCleanup = session.on(HCESession.Events.HCE_STATE_READ, () => {
    onReadCallback?.();
  });

  await session.setApplication(tag);
  await session.setEnabled(true);

  activeSession = session;
}

export async function stopTapToShare() {
  readListenerCleanup?.();
  readListenerCleanup = null;

  if (!activeSession) return;

  try {
    await activeSession.setEnabled(false);
  } finally {
    activeSession = null;
  }
}
