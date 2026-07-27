import { useCallback, useEffect, useRef, useState } from 'react';

import {
  extractInterimTail,
  mergeFinalSegment,
} from '@/lib/live-transcript-merge';
import { cleanLiveTranscript } from '@/lib/transcript-cleanup';

export type LiveTranscriptStatus = 'idle' | 'listening' | 'receiving' | 'unavailable' | 'transcribing';

export function useLiveTranscript({
  transcript,
  onTranscriptChange,
}: {
  transcript: string;
  onTranscriptChange: (value: string) => void;
}) {
  const finalRef = useRef(transcript);
  const interimRef = useRef('');
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureActiveRef = useRef(false);

  const [committedTranscript, setCommittedTranscript] = useState(transcript);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState<LiveTranscriptStatus>('idle');
  const [transcriptSupported, setTranscriptSupported] = useState(true);

  useEffect(() => {
    if (captureActiveRef.current) return;
    finalRef.current = transcript;
    setCommittedTranscript(transcript);
  }, [transcript]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  const syncCommitted = useCallback((value: string) => {
    finalRef.current = value;
    setCommittedTranscript(value);
    onTranscriptChange(value);
  }, [onTranscriptChange]);

  const commitPendingSpeech = useCallback(() => {
    const pending = interimRef.current.trim();
    if (!pending) return;
    const merged = mergeFinalSegment(finalRef.current, pending);
    finalRef.current = merged;
    interimRef.current = '';
    setInterimTranscript('');
    syncCommitted(merged);
  }, [syncCommitted]);

  const markListening = useCallback(() => {
    captureActiveRef.current = true;
    clearFeedbackTimer();
    setTranscriptSupported(true);
    setTranscriptStatus('listening');
    feedbackTimerRef.current = setTimeout(() => {
      if (!finalRef.current.trim() && !interimRef.current.trim()) {
        setTranscriptStatus('unavailable');
      }
    }, 5000);
  }, [clearFeedbackTimer]);

  const appendSpeechResult = useCallback((text: string, isFinal: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    captureActiveRef.current = true;
    clearFeedbackTimer();

    if (isFinal) {
      const merged = cleanLiveTranscript(mergeFinalSegment(finalRef.current, trimmed));
      finalRef.current = merged;
      interimRef.current = '';
      setInterimTranscript('');
      syncCommitted(merged);
    } else {
      const partial = extractInterimTail(finalRef.current, trimmed);
      interimRef.current = partial;
      setInterimTranscript(partial);
    }
    setTranscriptStatus('receiving');
  }, [clearFeedbackTimer, syncCommitted]);

  const finalizeTranscript = useCallback(() => {
    clearFeedbackTimer();
    const merged = cleanLiveTranscript(mergeFinalSegment(finalRef.current, interimRef.current));
    finalRef.current = merged;
    interimRef.current = '';
    setInterimTranscript('');
    syncCommitted(merged);
    return merged;
  }, [clearFeedbackTimer, syncCommitted]);

  const updateFromUser = useCallback((raw: string) => {
    clearFeedbackTimer();
    const cleaned = cleanLiveTranscript(raw);
    finalRef.current = cleaned;
    interimRef.current = '';
    setInterimTranscript('');
    syncCommitted(cleaned);
  }, [clearFeedbackTimer, syncCommitted]);

  const resetForRecording = useCallback(() => {
    clearFeedbackTimer();
    interimRef.current = '';
    setInterimTranscript('');
    finalRef.current = transcript;
    setCommittedTranscript(transcript);
  }, [clearFeedbackTimer, transcript]);

  const markTranscribing = useCallback(() => {
    clearFeedbackTimer();
    setTranscriptStatus('transcribing');
  }, [clearFeedbackTimer]);

  const markUnavailable = useCallback(() => {
    clearFeedbackTimer();
    setTranscriptSupported(false);
    setTranscriptStatus('unavailable');
  }, [clearFeedbackTimer]);

  const markIdle = useCallback(() => {
    captureActiveRef.current = false;
    clearFeedbackTimer();
    setTranscriptStatus('idle');
  }, [clearFeedbackTimer]);

  const displayTranscript = `${committedTranscript}${interimTranscript ? `${committedTranscript ? ' ' : ''}${interimTranscript}` : ''}`;

  return {
    interimTranscript,
    transcriptStatus,
    transcriptSupported,
    displayTranscript,
    markListening,
    appendSpeechResult,
    commitPendingSpeech,
    finalizeTranscript,
    updateFromUser,
    resetForRecording,
    markUnavailable,
    markTranscribing,
    markIdle,
  };
}

export type LiveTranscript = ReturnType<typeof useLiveTranscript>;
