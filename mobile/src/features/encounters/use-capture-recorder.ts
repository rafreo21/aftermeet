import * as DocumentPicker from 'expo-document-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
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

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

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

  const recordingStateRef = useRef<RecordingState>('idle');
  const speechCaptureRef = useRef(new NativeSpeechCapture());
  const liveSttReceivedRef = useRef(false);
  const speechTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onErrorRef = useRef(onError);
  const onImportReadyRef = useRef(onImportReady);
  const onImportStartedRef = useRef(onImportStarted);
  const onTranscriptFinalizedRef = useRef(onTranscriptFinalized);
  const transcribeFromServerRef = useRef(transcribeFromServer);
  const captureModeRef = useRef<SpeechCaptureMode>(captureMode);

  onErrorRef.current = onError;
  onImportReadyRef.current = onImportReady;
  onImportStartedRef.current = onImportStarted;
  onTranscriptFinalizedRef.current = onTranscriptFinalized;
  transcribeFromServerRef.current = transcribeFromServer;
  captureModeRef.current = captureMode;

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

    return () => {
      speechCaptureRef.current.abort();
      if (speechTimerRef.current) clearInterval(speechTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (usingSpeechCapture) return;
    void setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
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
        return next;
      });
    }, 1000);
  }, [clearSpeechTimer, publishDuration]);

  const transcribeErrorShownRef = useRef(false);

  const maybeTranscribeFromServer = useCallback(async (
    uri: string,
    cleanedTranscript: string,
    meta?: ImportRecordingMeta,
  ) => {
    const transcribe = transcribeFromServerRef.current;
    if (!transcribe) return cleanedTranscript;

    const needsServer =
      cleanedTranscript.trim().length < 20 ||
      !liveSttReceivedRef.current ||
      !isNativeSpeechTranscriptionAvailable();
    if (!needsServer) return cleanedTranscript;

    transcribeErrorShownRef.current = false;
    liveTranscript.markTranscribing();
    setTranscriptOpen(true);
    try {
      const serverTranscript = await transcribe(uri, meta);
      if (serverTranscript?.trim()) {
        liveTranscript.updateFromUser(serverTranscript);
        liveTranscript.markIdle();
        onTranscriptFinalizedRef.current?.(serverTranscript);
        return serverTranscript;
      }
      if (!transcribeErrorShownRef.current) {
        transcribeErrorShownRef.current = true;
        onErrorRef.current('Could not transcribe this recording. Paste or type what was said.');
      }
    } catch (error) {
      if (!transcribeErrorShownRef.current) {
        transcribeErrorShownRef.current = true;
        const message = error instanceof Error ? error.message : 'Could not transcribe this recording.';
        onErrorRef.current(message);
      }
    }

    liveTranscript.markUnavailable();
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
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
    audioRecorder.record();
  }, [audioRecorder]);

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
      setTranscriptOpen(true);
      setSpeechSeconds(0);
      publishDuration(0);
      setSpeechAudioLevel(0);
      setRecordingState('recording');

      const preferredMode = resolveSpeechCaptureMode();
      if (preferredMode !== 'none') {
        setCaptureMode(preferredMode);
        captureModeRef.current = preferredMode;
        speechCaptureRef.current.resetSession();
        const started = await startSpeechCapture(preferredMode);
        if (started) {
          startSpeechTimer();
          return;
        }

        if (preferredMode === 'unified') {
          const transcriptOnlyStarted = await startSpeechCapture('transcript-only');
          if (transcriptOnlyStarted) {
            setCaptureMode('transcript-only');
            captureModeRef.current = 'transcript-only';
            onErrorRef.current('Saved audio may be unavailable on this device. Live transcript is still active.');
            startSpeechTimer();
            return;
          }
        }
      }

      setCaptureMode('none');
      captureModeRef.current = 'none';
      liveTranscript.markListening();
      await startExpoAudioRecording();
    } catch {
      onErrorRef.current('Could not start recording. Check microphone permission and try again.');
      setRecordingState('idle');
    }
  }, [liveTranscript, publishDuration, startExpoAudioRecording, startSpeechCapture, startSpeechTimer]);

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
        const started = await startSpeechCapture(captureModeRef.current);
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
    if (recordingStateRef.current === 'stopped') return;

    setRecordingState('stopped');
    try {
      let uri: string | null = null;

      if (usingSpeechCapture) {
        liveTranscript.commitPendingSpeech();
        uri = await stopSpeechCapture();
        speechCaptureRef.current.resetSession();
      } else {
        await audioRecorder.stop();
        uri = audioRecorder.uri ?? recorderState.url;
      }

      publishDuration(seconds);
      let cleaned = liveTranscript.finalizeTranscript();

      if (uri) {
        if (!liveSttReceivedRef.current) {
          cleaned = await maybeTranscribeFromServer(uri, cleaned);
        } else if (cleaned) {
          onTranscriptFinalizedRef.current?.(cleaned);
        }
        setRecordingUri(uri);
        setRecordingSource('recorded');
        setPlaybackSource(uri);
        onRecordingUriChange(uri, 'recorded');
        setPlaybackReady(true);
      } else if (cleaned) {
        onTranscriptFinalizedRef.current?.(cleaned);
      } else if (!usingSpeechCapture) {
        cleaned = await maybeTranscribeFromServer('', cleaned);
      }

      setTranscriptOpen(true);
    } catch {
      onErrorRef.current('Recording stopped, but the audio file could not be saved on this device.');
    }
  }, [
    audioRecorder,
    liveTranscript,
    maybeTranscribeFromServer,
    onRecordingUriChange,
    publishDuration,
    recorderState.url,
    seconds,
    stopSpeechCapture,
    usingSpeechCapture,
  ]);

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
      setTranscriptOpen(true);
    }
    if (draft.transcript?.trim()) {
      liveTranscript.updateFromUser(draft.transcript);
    }
  }, [liveTranscript, publishDuration]);

  const transcribeRecordingIfNeeded = useCallback(async (uriOverride?: string) => {
    const uri = (uriOverride || recordingUri).trim();
    if (!uri || transcript.trim().length >= 20) return;
    if (liveTranscript.transcriptStatus === 'transcribing') return;
    await maybeTranscribeFromServer(uri, transcript.trim());
  }, [liveTranscript.transcriptStatus, maybeTranscribeFromServer, recordingUri, transcript]);

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

    speechCaptureRef.current.abort();
    liveTranscript.resetForRecording();
    setRecordingState('stopped');
    setRecordingSource('imported');
    setRecordingUri(asset.uri);
    setPlaybackSource(asset.uri);
    onRecordingUriChange(asset.uri, 'imported', importMeta);
    setTranscriptOpen(true);
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
        return 'Listening for words…';
      case 'transcribing':
        return 'Transcribing recording…';
      case 'unavailable':
        return isExpoGo()
          ? 'Recording — transcript appears when you tap Finish (requires sign-in)'
          : usingSpeechCapture
            ? 'Check mic and speech permissions in Settings'
            : 'Type or paste what was said';
      default:
        return 'Editable meeting record';
    }
  }, [liveTranscript.transcriptStatus, usingSpeechCapture]);

  return {
    recordingState,
    seconds,
    formattedDuration: formatDuration(seconds),
    audioLevel,
    transcriptOpen,
    setTranscriptOpen,
    transcriptStatus: liveTranscript.transcriptStatus,
    transcriptStatusLabel,
    transcriptSupported: isNativeSpeechTranscriptionAvailable(),
    usesServerTranscription: isExpoGo() || captureMode === 'none',
    recordingUri,
    recordingSource,
    recordingComplete: recordingState === 'stopped' || Boolean(recordingUri),
    playbackReady,
    displayTranscript: liveTranscript.displayTranscript,
    startRecording,
    pauseOrResume,
    stopRecording,
    resetRecording,
    importRecording,
    playRecording,
    updateTranscriptFromUser: liveTranscript.updateFromUser,
    hydrateFromDraft,
    transcribeRecordingIfNeeded,
  };
}

export type CaptureRecorder = ReturnType<typeof useCaptureRecorder>;
