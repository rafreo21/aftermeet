import * as DocumentPicker from 'expo-document-picker';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLiveTranscript, type LiveTranscriptStatus } from '@/features/encounters/live-transcript';
import {
  NativeSpeechCapture,
  isNativeSpeechTranscriptionAvailable,
  resolveSpeechCaptureMode,
  type SpeechCaptureMode,
} from '@/features/encounters/native-speech-transcript';
import { isSupportedAudioImport } from '@/features/encounters/audio-upload';
import { ensureRecordingsDirectory, formatDuration, recordingsDirectory } from '@/features/encounters/local-recordings';
import { isExpoGo } from '@/lib/runtime';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';
export type TranscriptStatus = LiveTranscriptStatus;
export type ImportRecordingMeta = { fileName?: string; mimeType?: string };
export type ServerTranscribePhase = 'idle' | 'preparing' | 'transcribing' | 'revealing' | 'done' | 'failed';

async function revealTranscriptProgressively(
  fullText: string,
  onChunk: (value: string) => void,
) {
  const words = fullText.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  let built = '';
  for (let index = 0; index < words.length; index += 1) {
    built += `${index ? ' ' : ''}${words[index]}`;
    onChunk(built);
    await new Promise((resolve) => setTimeout(resolve, index < 24 ? 28 : 8));
  }
}

type UseCaptureRecorderOptions = {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  onDurationChange: (seconds: number) => void;
  onRecordingUriChange: (uri: string, source: 'recorded' | 'imported', meta?: ImportRecordingMeta) => void;
  onError: (message: string) => void;
  onImportReady?: () => void;
  onImportStarted?: () => void;
  onTranscriptFinalized?: (transcript: string) => void;
  transcribeFromServer?: (uri: string, meta?: ImportRecordingMeta) => Promise<string | null>;
};

/**
 * Mono, 16kHz, 32kbps AAC — Whisper resamples everything to 16kHz mono anyway, so the
 * stereo 44.1kHz/128kbps HIGH_QUALITY preset was spending ~4x the bytes for no
 * transcription benefit. At this bitrate a full MAX_RECORDING_SECONDS (1hr) clip is
 * ~14MB, comfortably under Whisper's 25MB upload limit (see audio-upload.ts).
 */
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  directory: 'document',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};

/** Hard cap for on-device capture — auto Finish when reached. */
export const MAX_RECORDING_SECONDS = 60 * 60;

export function useCaptureRecorder({
  transcript,
  onTranscriptChange,
  onDurationChange,
  onRecordingUriChange,
  onError,
  onImportReady,
  onImportStarted,
  onTranscriptFinalized,
  transcribeFromServer,
}: UseCaptureRecorderOptions) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [recordingUri, setRecordingUri] = useState('');
  const [recordingSource, setRecordingSource] = useState<'recorded' | 'imported'>('recorded');
  const [playbackReady, setPlaybackReady] = useState(false);
  const [playbackSource, setPlaybackSource] = useState<string | null>(null);
  const [speechAudioLevel, setSpeechAudioLevel] = useState(0);
  const [speechSeconds, setSpeechSeconds] = useState(0);
  const [captureMode, setCaptureMode] = useState<SpeechCaptureMode>(() => resolveSpeechCaptureMode());
  const [serverTranscribePhase, setServerTranscribePhase] = useState<ServerTranscribePhase>('idle');
  const [serverTranscribeError, setServerTranscribeError] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  const recordingStateRef = useRef<RecordingState>('idle');
  const speechCaptureRef = useRef(new NativeSpeechCapture());
  const liveSttReceivedRef = useRef(false);
  const speechTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});
  const finishPromiseRef = useRef<Promise<void> | null>(null);
  const lastTranscribeMetaRef = useRef<ImportRecordingMeta | undefined>(undefined);
  const onErrorRef = useRef(onError);
  const onImportReadyRef = useRef(onImportReady);
  const onImportStartedRef = useRef(onImportStarted);
  const onTranscriptFinalizedRef = useRef(onTranscriptFinalized);
  const transcribeFromServerRef = useRef(transcribeFromServer);
  const captureModeRef = useRef<SpeechCaptureMode>(captureMode);

  useEffect(() => {
    onErrorRef.current = onError;
    onImportReadyRef.current = onImportReady;
    onImportStartedRef.current = onImportStarted;
    onTranscriptFinalizedRef.current = onTranscriptFinalized;
    transcribeFromServerRef.current = transcribeFromServer;
    captureModeRef.current = captureMode;
  }, [captureMode, onError, onImportReady, onImportStarted, onTranscriptFinalized, transcribeFromServer]);

  const liveTranscript = useLiveTranscript({ transcript, onTranscriptChange });

  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const player = useAudioPlayer(playbackSource);

  const usingSpeechCapture = captureMode === 'unified' || captureMode === 'transcript-only';

  const seconds = useMemo(
    () => (usingSpeechCapture
      ? speechSeconds
      : Math.max(0, Math.round(recorderState.durationMillis / 1000))),
    [recorderState.durationMillis, speechSeconds, usingSpeechCapture],
  );

  const audioLevel = useMemo(() => {
    if (usingSpeechCapture) return speechAudioLevel;
    if (typeof recorderState.metering !== 'number') return 0;
    return Math.min(1, Math.max(0, (recorderState.metering + 160) / 160));
  }, [recorderState.metering, speechAudioLevel, usingSpeechCapture]);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    if (recordingState !== 'recording' && recordingState !== 'paused') return;
    const display = liveTranscript.displayTranscript.trim();
    if (!display) return;

    const timer = setTimeout(() => {
      onTranscriptChange(display);
    }, 400);

    return () => clearTimeout(timer);
  }, [liveTranscript.displayTranscript, onTranscriptChange, recordingState]);

  useEffect(() => {
    void ensureRecordingsDirectory().catch(() => {});
    const speechCapture = speechCaptureRef.current;

    return () => {
      speechCapture.abort();
      if (speechTimerRef.current) clearInterval(speechTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (usingSpeechCapture) return;
    void setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      allowsBackgroundRecording: true,
    }).catch(() => {});
  }, [usingSpeechCapture]);

  const publishDuration = useCallback((nextSeconds: number) => {
    onDurationChange(nextSeconds);
  }, [onDurationChange]);

  const clearSpeechTimer = useCallback(() => {
    if (speechTimerRef.current) {
      clearInterval(speechTimerRef.current);
      speechTimerRef.current = null;
    }
  }, []);

  const startSpeechTimer = useCallback(() => {
    clearSpeechTimer();
    speechTimerRef.current = setInterval(() => {
      setSpeechSeconds((current) => {
        const next = current + 1;
        publishDuration(next);
        if (next >= MAX_RECORDING_SECONDS) {
          void stopRecordingRef.current();
        }
        return next;
      });
    }, 1000);
  }, [clearSpeechTimer, publishDuration]);

  // Auto-stop expo-audio captures at the same 1-hour cap.
  useEffect(() => {
    if (usingSpeechCapture) return;
    if (recordingState !== 'recording' && recordingState !== 'paused') return;
    if (seconds < MAX_RECORDING_SECONDS) return;
    void stopRecordingRef.current();
  }, [recordingState, seconds, usingSpeechCapture]);

  const transcribeErrorShownRef = useRef(false);
  const transcribeInFlightRef = useRef(false);
  const transcribedUriRef = useRef('');

  const maybeTranscribeFromServer = useCallback(async (
    uri: string,
    cleanedTranscript: string,
    meta?: ImportRecordingMeta,
    options?: { force?: boolean },
  ) => {
    const transcribe = transcribeFromServerRef.current;
    if (!transcribe) return cleanedTranscript;

    const normalizedUri = uri.trim();
    if (!normalizedUri) return cleanedTranscript;
    if (!options?.force && transcribedUriRef.current === normalizedUri) return cleanedTranscript;
    if (transcribeInFlightRef.current) return cleanedTranscript;

    const needsServer =
      cleanedTranscript.trim().length < 20 ||
      !liveSttReceivedRef.current ||
      !isNativeSpeechTranscriptionAvailable();
    if (!needsServer) return cleanedTranscript;

    lastTranscribeMetaRef.current = meta;
    transcribeErrorShownRef.current = false;
    transcribeInFlightRef.current = true;
    setServerTranscribeError('');
    setServerTranscribePhase('preparing');
    liveTranscript.markTranscribing();
    try {
      setServerTranscribePhase('transcribing');
      const serverTranscript = await transcribe(normalizedUri, meta);
      if (serverTranscript?.trim()) {
        setServerTranscribePhase('revealing');
        liveTranscript.markTranscribing();
        await revealTranscriptProgressively(serverTranscript, (partial) => {
          liveTranscript.updateFromUser(partial);
        });
        liveTranscript.updateFromUser(serverTranscript);
        liveTranscript.markIdle();
        setServerTranscribePhase('done');
        transcribedUriRef.current = normalizedUri;
        onTranscriptFinalizedRef.current?.(serverTranscript);
        return serverTranscript;
      }
      const emptyMessage = 'No speech detected in this recording. Paste a transcript manually.';
      setServerTranscribePhase('failed');
      setServerTranscribeError(emptyMessage);
      liveTranscript.markIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not transcribe this recording.';
      setServerTranscribePhase('failed');
      setServerTranscribeError(message);
      liveTranscript.markIdle();
    } finally {
      transcribeInFlightRef.current = false;
    }

    return cleanedTranscript;
  }, [liveTranscript]);

  const startSpeechCapture = useCallback(async (mode: SpeechCaptureMode) => {
    liveSttReceivedRef.current = false;
    liveTranscript.markListening();
    await ensureRecordingsDirectory();
    const started = await speechCaptureRef.current.start({
      mode,
      outputDirectory: recordingsDirectory(),
      onResult: (text, isFinal) => {
        if (text.trim()) liveSttReceivedRef.current = true;
        liveTranscript.appendSpeechResult(text, isFinal);
      },
      onVolume: setSpeechAudioLevel,
      onListening: () => liveTranscript.markListening(),
      onSegmentEnd: () => liveTranscript.commitPendingSpeech(),
      onError: (message) => onErrorRef.current(message),
      onUnavailable: () => liveTranscript.markUnavailable(),
    });
    if (!started) {
      liveTranscript.markUnavailable();
    }
    return started;
  }, [liveTranscript]);

  const startExpoAudioRecording = useCallback(async () => {
    await ensureRecordingsDirectory();
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      allowsBackgroundRecording: true,
    });
    await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
    audioRecorder.record();
  }, [audioRecorder]);

  const stopExpoAudioRecording = useCallback(async () => {
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
    } catch {
      // still try to read uri below
    }
    // Expo sometimes exposes the URI a tick after stop.
    let uri = audioRecorder.uri ?? recorderState.url ?? null;
    if (!uri) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      uri = audioRecorder.uri ?? recorderState.url ?? null;
    }
    return uri;
  }, [audioRecorder, recorderState.url]);

  const stopSpeechCapture = useCallback(async () => {
    clearSpeechTimer();
    return speechCaptureRef.current.stop();
  }, [clearSpeechTimer]);

  const startRecording = useCallback(async (consent: boolean) => {
    if (!consent) {
      onErrorRef.current('Confirm that everyone agreed before recording.');
      return;
    }

    setPlaybackReady(false);
    setPlaybackSource(null);
    onErrorRef.current('');

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      onErrorRef.current('Microphone access was not granted. Check Settings and try again.');
      return;
    }

    try {
      liveTranscript.resetForRecording();
      setSpeechSeconds(0);
      publishDuration(0);
      setSpeechAudioLevel(0);
      setRecordingState('recording');

      // Always record with expo-audio so Finish saves a real file on every device.
      // OpenAI Whisper builds the transcript after Finish.
      setCaptureMode('none');
      captureModeRef.current = 'none';
      liveTranscript.markListening();
      await startExpoAudioRecording();
    } catch {
      onErrorRef.current('Could not start recording. Check microphone permission and try again.');
      setRecordingState('idle');
    }
  }, [liveTranscript, publishDuration, startExpoAudioRecording]);

  const pauseOrResume = useCallback(async () => {
    if (recordingStateRef.current === 'recording') {
      liveTranscript.finalizeTranscript();
      if (usingSpeechCapture) {
        clearSpeechTimer();
        speechCaptureRef.current.abort();
      } else {
        audioRecorder.pause();
      }
      setRecordingState('paused');
      publishDuration(seconds);
      return;
    }

    if (recordingStateRef.current === 'paused') {
      liveTranscript.resetForRecording();
      setRecordingState('recording');
      if (usingSpeechCapture) {
        const started = await startSpeechCapture('unified');
        if (started) startSpeechTimer();
      } else {
        audioRecorder.record();
      }
    }
  }, [
    audioRecorder,
    clearSpeechTimer,
    liveTranscript,
    publishDuration,
    seconds,
    startSpeechCapture,
    startSpeechTimer,
    usingSpeechCapture,
  ]);

  const stopRecording = useCallback(async () => {
    if (finishPromiseRef.current) {
      await finishPromiseRef.current;
      return;
    }
    if (recordingStateRef.current === 'stopped' && !isFinishing) return;

    const run = (async () => {
      recordingStateRef.current = 'stopped';
      setIsFinishing(true);
      setRecordingState('stopped');
      try {
        let uri: string | null = null;

        if (usingSpeechCapture) {
          liveTranscript.commitPendingSpeech();
          uri = await stopSpeechCapture();
          speechCaptureRef.current.resetSession();
        } else {
          uri = await stopExpoAudioRecording();
        }

        publishDuration(seconds);
        let cleaned = liveTranscript.finalizeTranscript();
        const mimeType = uri?.toLowerCase().includes('.wav')
          ? 'audio/wav'
          : uri?.toLowerCase().includes('.mp3')
            ? 'audio/mpeg'
            : 'audio/mp4';
        const fileName = uri?.split('/').pop()?.split('?')[0] || 'recording.m4a';

        if (uri) {
          if (!liveSttReceivedRef.current || cleaned.trim().length < 20) {
            cleaned = await maybeTranscribeFromServer(uri, cleaned, { fileName, mimeType }, { force: true });
          } else if (cleaned) {
            onTranscriptFinalizedRef.current?.(cleaned);
          }
          setRecordingUri(uri);
          setRecordingSource('recorded');
          setPlaybackSource(uri);
          onRecordingUriChange(uri, 'recorded', { fileName, mimeType });
          setPlaybackReady(true);
          onErrorRef.current('');
        } else if (cleaned.trim()) {
          onTranscriptFinalizedRef.current?.(cleaned);
          onErrorRef.current(
            'Transcript is ready, but no audio file was saved. Tap Record again — we need the file for playback and guest sharing.',
          );
        } else {
          onErrorRef.current('Finish stopped the session, but no audio was saved. Tap Record and try again.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Finish stopped the session, but nothing was saved. Tap Record and try again.';
        onErrorRef.current(message);
      } finally {
        setIsFinishing(false);
      }
    })();

    finishPromiseRef.current = run;
    try {
      await run;
    } finally {
      if (finishPromiseRef.current === run) finishPromiseRef.current = null;
    }
  }, [
    isFinishing,
    liveTranscript,
    maybeTranscribeFromServer,
    onRecordingUriChange,
    publishDuration,
    seconds,
    stopExpoAudioRecording,
    stopSpeechCapture,
    usingSpeechCapture,
  ]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const awaitPendingFinish = useCallback(async () => {
    if (finishPromiseRef.current) await finishPromiseRef.current;
  }, []);

  const hydrateFromDraft = useCallback((draft: {
    recordingUri?: string;
    recordingSource?: 'recorded' | 'imported' | '';
    transcript?: string;
    durationSeconds?: number;
  }) => {
    if (draft.recordingUri?.trim()) {
      setRecordingState('stopped');
      setRecordingUri(draft.recordingUri);
      setPlaybackSource(draft.recordingUri);
      setPlaybackReady(true);
      if (draft.recordingSource === 'imported' || draft.recordingSource === 'recorded') {
        setRecordingSource(draft.recordingSource);
      }
      if (draft.durationSeconds && draft.durationSeconds > 0) {
        publishDuration(draft.durationSeconds);
      }
    }
    if (draft.transcript?.trim()) {
      liveTranscript.updateFromUser(draft.transcript);
    }
  }, [liveTranscript, publishDuration]);

  const transcribeRecordingIfNeeded = useCallback(async (uriOverride?: string, force = false) => {
    const uri = (uriOverride || recordingUri).trim();
    if (!uri || transcript.trim().length >= 20) return;
    if (!force && transcribedUriRef.current === uri) return;
    if (transcribeInFlightRef.current) return;
    if (liveTranscript.transcriptStatus === 'transcribing') return;
    await maybeTranscribeFromServer(uri, transcript.trim(), lastTranscribeMetaRef.current, { force });
  }, [liveTranscript.transcriptStatus, maybeTranscribeFromServer, recordingUri, transcript]);

  const retryTranscription = useCallback(async () => {
    const uri = recordingUri.trim();
    if (!uri) return;
    transcribedUriRef.current = '';
    setServerTranscribeError('');
    setServerTranscribePhase('idle');
    await maybeTranscribeFromServer(uri, '', lastTranscribeMetaRef.current, { force: true });
  }, [maybeTranscribeFromServer, recordingUri]);

  const resetRecording = useCallback(async () => {
    if (usingSpeechCapture) {
      speechCaptureRef.current.abort();
      speechCaptureRef.current.resetSession();
      clearSpeechTimer();
      setSpeechSeconds(0);
      setSpeechAudioLevel(0);
    } else {
      try {
        if (audioRecorder.isRecording) {
          await audioRecorder.stop();
        }
      } catch {
        // ignore
      }
    }
    player.pause();
    setRecordingState('idle');
    setCaptureMode(resolveSpeechCaptureMode());
    publishDuration(0);
    setRecordingUri('');
    setPlaybackSource(null);
    setPlaybackReady(false);
    transcribedUriRef.current = '';
    setServerTranscribePhase('idle');
    setServerTranscribeError('');
    liveTranscript.markIdle();
  }, [audioRecorder, clearSpeechTimer, liveTranscript, player, publishDuration, usingSpeechCapture]);

  const importRecording = useCallback(async (consent: boolean) => {
    if (!consent) {
      onErrorRef.current('Confirm that everyone agreed to the recording before importing it.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    onImportStartedRef.current?.();
    transcribedUriRef.current = '';
    transcribeErrorShownRef.current = false;
    setServerTranscribePhase('idle');
    setServerTranscribeError('');
    if (!isSupportedAudioImport(asset.name ?? undefined, asset.mimeType ?? undefined, asset.uri)) {
      onErrorRef.current('Unsupported format. Choose an audio file such as M4A, MP3, or WAV.');
      return;
    }
    if (asset.size && asset.size > 250 * 1024 * 1024) {
      onErrorRef.current('That recording is larger than 250 MB. Choose a shorter or compressed recording.');
      return;
    }

    const importMeta: ImportRecordingMeta = {
      fileName: asset.name ?? undefined,
      mimeType: asset.mimeType ?? undefined,
    };
    lastTranscribeMetaRef.current = importMeta;

    speechCaptureRef.current.abort();
    liveTranscript.resetForRecording();
    setRecordingState('stopped');
    setRecordingSource('imported');
    setRecordingUri(asset.uri);
    setPlaybackSource(asset.uri);
    onRecordingUriChange(asset.uri, 'imported', importMeta);
    setPlaybackReady(true);
    publishDuration(Math.max(0, Math.round(player.duration || 0)));
    onImportReadyRef.current?.();
    void maybeTranscribeFromServer(asset.uri, '', importMeta);
  }, [liveTranscript, maybeTranscribeFromServer, onRecordingUriChange, player.duration, publishDuration]);

  const playRecording = useCallback(async () => {
    if (!recordingUri) return;
    try {
      if (playbackSource !== recordingUri) {
        setPlaybackSource(recordingUri);
      }
      player.replace(recordingUri);
      player.play();
    } catch {
      onErrorRef.current('Could not play this recording on your device.');
    }
  }, [playbackSource, player, recordingUri]);

  const transcriptStatusLabel = useMemo(() => {
    switch (liveTranscript.transcriptStatus) {
      case 'receiving':
        return 'Receiving speech live';
      case 'listening':
        return usingSpeechCapture
          ? 'Listening for words…'
          : 'Recording audio…';
      case 'transcribing':
        return 'Transcribing with OpenAI…';
      case 'unavailable':
        return isExpoGo()
          ? 'Recording. Transcript appears when you tap Finish (requires sign-in)'
          : usingSpeechCapture
            ? 'Check mic and speech permissions in Settings'
            : 'Recording audio. Transcript appears when you tap Finish';
      default:
        return usingSpeechCapture
          ? 'Editable meeting record'
          : recordingState === 'recording' || recordingState === 'paused'
            ? 'Recording audio. Transcript appears when you tap Finish'
            : 'Editable meeting record';
    }
  }, [liveTranscript.transcriptStatus, recordingState, usingSpeechCapture]);

  return {
    recordingState,
    seconds,
    formattedDuration: formatDuration(seconds),
    audioLevel,
    transcriptOpen,
    setTranscriptOpen,
    transcriptStatus: liveTranscript.transcriptStatus,
    transcriptStatusLabel,
    serverTranscribePhase,
    serverTranscribeError,
    transcriptSupported: isNativeSpeechTranscriptionAvailable(),
    usesServerTranscription: isExpoGo() || captureMode === 'none',
    recordingUri,
    recordingSource,
    recordingComplete: recordingState === 'stopped' || Boolean(recordingUri),
    playbackReady,
    isFinishing,
    displayTranscript: liveTranscript.displayTranscript,
    startRecording,
    pauseOrResume,
    stopRecording,
    awaitPendingFinish,
    resetRecording,
    importRecording,
    playRecording,
    updateTranscriptFromUser: liveTranscript.updateFromUser,
    hydrateFromDraft,
    transcribeRecordingIfNeeded,
    retryTranscription,
  };
}

export type CaptureRecorder = ReturnType<typeof useCaptureRecorder>;
