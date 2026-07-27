import { requireOptionalNativeModule } from 'expo-modules-core';

type SpeechResultEvent = {
  isFinal: boolean;
  results: Array<{ transcript: string }>;
};

type SpeechErrorEvent = {
  error: string;
  message?: string;
};

type SpeechModule = {
  isRecognitionAvailable: () => boolean;
  start: (options: {
    lang?: string;
    interimResults?: boolean;
    continuous?: boolean;
    addsPunctuation?: boolean;
    maxAlternatives?: number;
  }) => void;
  stop: () => void;
  abort: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean; status?: string }>;
  requestMicrophonePermissionsAsync?: () => Promise<{ granted: boolean }>;
  requestSpeechRecognizerPermissionsAsync?: () => Promise<{ granted: boolean }>;
  addListener: (
    eventName: string,
    listener: (event: SpeechResultEvent | SpeechErrorEvent | null) => void,
  ) => { remove: () => void };
};

const speechModule = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');

const FATAL_SPEECH_ERRORS = new Set([
  'not-allowed',
  'service-not-allowed',
  'language-not-supported',
  'audio-capture',
]);

export function isNativeSpeechTranscriptionAvailable() {
  return Boolean(speechModule?.isRecognitionAvailable?.());
}

export class NativeSpeechTranscription {
  private subscriptions: Array<{ remove: () => void }> = [];
  private active = false;

  isAvailable() {
    return isNativeSpeechTranscriptionAvailable();
  }

  async start(
    onResult: (text: string, isFinal: boolean) => void,
    onUnavailable: () => void,
  ): Promise<boolean> {
    if (!speechModule?.isRecognitionAvailable()) {
      onUnavailable();
      return false;
    }

    try {
      const micPermission = await speechModule.requestMicrophonePermissionsAsync?.();
      const speechPermission = await speechModule.requestSpeechRecognizerPermissionsAsync?.();
      const permission = await speechModule.requestPermissionsAsync();
      const granted =
        permission.granted &&
        (micPermission?.granted ?? true) &&
        (speechPermission?.granted ?? true);
      if (!granted) {
        onUnavailable();
        return false;
      }

      this.cleanup();
      this.active = true;

      this.subscriptions.push(
        speechModule.addListener('result', (event) => {
          const payload = event as SpeechResultEvent | null;
          const text = payload?.results?.[0]?.transcript ?? '';
          if (!text.trim() || !payload) return;
          onResult(text, payload.isFinal);
        }),
      );

      this.subscriptions.push(
        speechModule.addListener('error', (event) => {
          const payload = event as SpeechErrorEvent | null;
          if (!payload || !FATAL_SPEECH_ERRORS.has(payload.error)) return;
          onUnavailable();
        }),
      );

      this.subscriptions.push(
        speechModule.addListener('end', () => {
          if (!this.active || !speechModule) return;
          try {
            speechModule.start({
              lang: 'en-GB',
              interimResults: true,
              continuous: true,
              addsPunctuation: true,
              maxAlternatives: 1,
            });
          } catch {
            // ignore restart failures
          }
        }),
      );

      speechModule.start({
        lang: 'en-GB',
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        maxAlternatives: 1,
      });
      return true;
    } catch {
      this.active = false;
      onUnavailable();
      return false;
    }
  }

  stop() {
    this.active = false;
    try {
      speechModule?.stop();
    } catch {
      // ignore
    }
    this.cleanup();
  }

  abort() {
    this.active = false;
    try {
      speechModule?.abort();
    } catch {
      // ignore
    }
    this.cleanup();
  }

  cleanup() {
    for (const subscription of this.subscriptions) {
      subscription.remove();
    }
    this.subscriptions = [];
  }
}
