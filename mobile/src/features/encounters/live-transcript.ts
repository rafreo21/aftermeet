import { useCallback, useEffect, useRef, useState } from 'react';

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

  const [interimTranscript, setInterimTranscript] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState<LiveTranscriptStatus>('idle');
  const [transcriptSupported, setTranscriptSupported] = useState(true);

  useEffect(() => {
    finalRef.current = transcript;
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

  const markListening = useCallback(() => {
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

    clearFeedbackTimer();
    if (isFinal) {
      const current = finalRef.current.trim();
      const merged = current && (trimmed.startsWith(current) || current.includes(trimmed))
        ? trimmed.startsWith(current)
          ? trimmed
          : current
        : `${current} ${trimmed}`.replace(/\s+/g, ' ').trim();
      finalRef.current = cleanLiveTranscript(merged);
      interimRef.current = '';
      setInterimTranscript('');
      onTranscriptChange(finalRef.current);
    } else {
      interimRef.current = trimmed;
      setInterimTranscript(trimmed);
    }
    setTranscriptStatus('receiving');
  }, [clearFeedbackTimer, onTranscriptChange]);

  const finalizeTranscript = useCallback(() => {
    clearFeedbackTimer();
    const merged = cleanLiveTranscript(`${finalRef.current} ${interimRef.current}`.replace(/\s+/g, ' ').trim());
    finalRef.current = merged;
    interimRef.current = '';
    setInterimTranscript('');
    onTranscriptChange(merged);
    return merged;
  }, [clearFeedbackTimer, onTranscriptChange]);

  const updateFromUser = useCallback((raw: string) => {
    clearFeedbackTimer();
    const cleaned = cleanLiveTranscript(raw);
    finalRef.current = cleaned;
    interimRef.current = '';
    setInterimTranscript('');
    onTranscriptChange(cleaned);
  }, [clearFeedbackTimer, onTranscriptChange]);

  const resetForRecording = useCallback(() => {
    clearFeedbackTimer();
    interimRef.current = '';
    setInterimTranscript('');
    finalRef.current = transcript;
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
    clearFeedbackTimer();
    setTranscriptStatus('idle');
  }, [clearFeedbackTimer]);

  const displayTranscript = `${transcript}${interimTranscript ? `${transcript ? ' ' : ''}${interimTranscript}` : ''}`;

  return {
    interimTranscript,
    transcriptStatus,
    transcriptSupported,
    displayTranscript,
    markListening,
    appendSpeechResult,
    finalizeTranscript,
    updateFromUser,
    resetForRecording,
    markUnavailable,
    markTranscribing,
    markIdle,
  };
}

export type LiveTranscript = ReturnType<typeof useLiveTranscript>;
