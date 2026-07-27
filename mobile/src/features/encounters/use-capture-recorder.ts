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
import { NativeSpeechTranscription, isNativeSpeechTranscriptionAvailable } from '@/features/encounters/native-speech-transcript';
import { ensureRecordingsDirectory, formatDuration } from '@/features/encounters/local-recordings';
import { isExpoGo } from '@/lib/runtime';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';
export type TranscriptStatus = LiveTranscriptStatus;

type UseCaptureRecorderOptions = {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  onDurationChange: (seconds: number) => void;
  onRecordingUriChange: (uri: string, source: 'recorded' | 'imported') => void;
  onError: (message: string) => void;
  onTranscriptFinalized?: (transcript: string) => void;
  transcribeFromServer?: (uri: string) => Promise<string | null>;
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
  onTranscriptFinalized,
  transcribeFromServer,
}: UseCaptureRecorderOptions) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [recordingUri, setRecordingUri] = useState('');
  const [recordingSource, setRecordingSource] = useState<'recorded' | 'imported'>('recorded');
  const [playbackReady, setPlaybackReady] = useState(false);
  const [playbackSource, setPlaybackSource] = useState<string | null>(null);

  const recordingStateRef = useRef<RecordingState>('idle');
  const speechRef = useRef(new NativeSpeechTranscription());
  const liveSttReceivedRef = useRef(false);
  const onErrorRef = useRef(onError);
  const onTranscriptFinalizedRef = useRef(onTranscriptFinalized);
  const transcribeFromServerRef = useRef(transcribeFromServer);

  onErrorRef.current = onError;
  onTranscriptFinalizedRef.current = onTranscriptFinalized;
  transcribeFromServerRef.current = transcribeFromServer;

  const liveTranscript = useLiveTranscript({ transcript, onTranscriptChange });

  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const player = useAudioPlayer(playbackSource);

  const seconds = useMemo(
    () => Math.max(0, Math.round(recorderState.durationMillis / 1000)),
    [recorderState.durationMillis],
  );

  const audioLevel = useMemo(() => {
    if (typeof recorderState.metering !== 'number') return 0;
    return Math.min(1, Math.max(0, (recorderState.metering + 160) / 160));
  }, [recorderState.metering]);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    void ensureRecordingsDirectory().catch(() => {});
    void setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    }).catch(() => {});

    return () => {
      speechRef.current.abort();
    };
  }, []);

  const publishDuration = useCallback((nextSeconds: number) => {
    onDurationChange(nextSeconds);
  }, [onDurationChange]);

  const startSpeechTranscription = useCallback(async () => {
    liveSttReceivedRef.current = false;
    liveTranscript.markListening();
    const started = await speechRef.current.start(
      (text, isFinal) => {
        if (text.trim()) liveSttReceivedRef.current = true;
        liveTranscript.appendSpeechResult(text, isFinal);
      },
      () => liveTranscript.markUnavailable(),
    );
    if (!started && !speechRef.current.isAvailable()) {
      liveTranscript.markUnavailable();
    }
  }, [liveTranscript]);

  const maybeTranscribeFromServer = useCallback(async (uri: string, cleanedTranscript: string) => {
    const transcribe = transcribeFromServerRef.current;
    if (!transcribe) return cleanedTranscript;

    const needsServer =
      cleanedTranscript.trim().length < 20 ||
      !liveSttReceivedRef.current ||
      !isNativeSpeechTranscriptionAvailable();
    if (!needsServer) return cleanedTranscript;

    liveTranscript.markTranscribing();
    setTranscriptOpen(true);
    try {
      const serverTranscript = await transcribe(uri);
      if (serverTranscript?.trim()) {
        liveTranscript.updateFromUser(serverTranscript);
        liveTranscript.markIdle();
        onTranscriptFinalizedRef.current?.(serverTranscript);
        return serverTranscript;
      }
      onErrorRef.current('Could not transcribe this recording. Paste or type what was said.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not transcribe this recording.';
      onErrorRef.current(message);
    }

    liveTranscript.markUnavailable();
    return cleanedTranscript;
  }, [liveTranscript]);

  const stopSpeechTranscription = useCallback(() => {
    speechRef.current.stop();
  }, []);

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
      await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
      audioRecorder.record();
      setTranscriptOpen(true);
      publishDuration(0);
      setRecordingState('recording');
      await startSpeechTranscription();
    } catch {
      onErrorRef.current('Could not start recording. Check microphone permission and try again.');
    }
  }, [audioRecorder, liveTranscript, publishDuration, startSpeechTranscription]);

  const pauseOrResume = useCallback(async () => {
    if (recordingStateRef.current === 'recording') {
      liveTranscript.finalizeTranscript();
      stopSpeechTranscription();
      audioRecorder.pause();
      setRecordingState('paused');
      publishDuration(seconds);
      return;
    }

    if (recordingStateRef.current === 'paused') {
      liveTranscript.resetForRecording();
      audioRecorder.record();
      setRecordingState('recording');
      await startSpeechTranscription();
    }
  }, [audioRecorder, liveTranscript, publishDuration, seconds, startSpeechTranscription, stopSpeechTranscription]);

  const stopRecording = useCallback(async () => {
    if (recordingStateRef.current === 'stopped') return;

    stopSpeechTranscription();
    setRecordingState('stopped');
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? recorderState.url;
      publishDuration(seconds);
      let cleaned = liveTranscript.finalizeTranscript();
      if (uri) {
        cleaned = await maybeTranscribeFromServer(uri, cleaned);
      } else if (cleaned) {
        onTranscriptFinalizedRef.current?.(cleaned);
      }
      if (uri) {
        setRecordingUri(uri);
        setRecordingSource('recorded');
        setPlaybackSource(uri);
        onRecordingUriChange(uri, 'recorded');
        setPlaybackReady(true);
      }
      setTranscriptOpen(true);
    } catch {
      onErrorRef.current('Recording stopped, but the audio file could not be saved on this device.');
    }
  }, [
    audioRecorder,
    liveTranscript,
    onRecordingUriChange,
    publishDuration,
    recorderState.url,
    seconds,
    stopSpeechTranscription,
    maybeTranscribeFromServer,
  ]);

  const resetRecording = useCallback(async () => {
    stopSpeechTranscription();
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
    } catch {
      // ignore
    }
    player.pause();
    setRecordingState('idle');
    publishDuration(0);
    setRecordingUri('');
    setPlaybackSource(null);
    setPlaybackReady(false);
    liveTranscript.markIdle();
  }, [audioRecorder, liveTranscript, player, publishDuration, stopSpeechTranscription]);

  const importRecording = useCallback(async (consent: boolean) => {
    if (!consent) {
      onErrorRef.current('Confirm that everyone agreed to the recording before importing it.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > 250 * 1024 * 1024) {
      onErrorRef.current('That recording is larger than 250 MB. Choose a shorter or compressed recording.');
      return;
    }

    stopSpeechTranscription();
    setRecordingState('stopped');
    setRecordingSource('imported');
    setRecordingUri(asset.uri);
    setPlaybackSource(asset.uri);
    onRecordingUriChange(asset.uri, 'imported');
    setTranscriptOpen(true);
    setPlaybackReady(true);
    publishDuration(Math.max(0, Math.round(player.duration || 0)));
    const cleaned = await maybeTranscribeFromServer(asset.uri, transcript.trim());
    if (cleaned && cleaned !== transcript.trim()) {
      liveTranscript.updateFromUser(cleaned);
    } else {
      liveTranscript.markIdle();
    }
  }, [liveTranscript, maybeTranscribeFromServer, onRecordingUriChange, player.duration, publishDuration, stopSpeechTranscription, transcript]);

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
          : liveTranscript.transcriptSupported
            ? 'Live transcription unavailable — audio is still recording'
            : 'Type or paste what was said';
      default:
        return 'Editable meeting record';
    }
  }, [liveTranscript.transcriptStatus, liveTranscript.transcriptSupported]);

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
    usesServerTranscription: isExpoGo() || !isNativeSpeechTranscriptionAvailable(),
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
  };
}

export type CaptureRecorder = ReturnType<typeof useCaptureRecorder>;
