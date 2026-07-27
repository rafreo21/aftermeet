import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PaperPlaneTilt } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CaptureContextStep } from '@/components/capture-context-step';
import { CaptureGatherStep } from '@/components/capture-gather-step';
import { CaptureLeaveSheet } from '@/components/capture-leave-sheet';
import { CaptureRecordStep } from '@/components/capture-record-step';
import { CaptureStepIndicator } from '@/components/capture-step-indicator';
import {
  type ContextGenerationStatus,
} from '@/components/context-generation-banner';
import { Body, Button, PageHeader } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  createFreshCaptureDraft,
  deleteCaptureDraft,
  EMPTY_CAPTURE_DRAFT,
  hasCaptureDraftProgress,
  readCaptureDraft,
  setAuthReturnPath,
  writeCaptureDraft,
  type CaptureWizardDraft,
} from '@/features/encounters/capture-draft';
import {
  applyExtractionDraft,
} from '@/features/encounters/extraction-helpers';
import {
  deleteLocalRecording,
  removeExpiredLocalRecordings,
  saveLocalRecording,
} from '@/features/encounters/local-recordings';
import {
  buildEncounterPayload,
  extractEncounterDraft,
  fetchInboundExchanges,
  fetchPublicCardName,
  saveEncounter,
  transcribeEncounterAudio,
  uploadEncounterRecording,
  type InboundExchange,
} from '@/features/encounters/encounter-api';
import { useCaptureRecorder } from '@/features/encounters/use-capture-recorder';
import { normalizeTranscriptForExtraction } from '@/lib/transcript-cleanup';
import { useAppInsets } from '@/lib/safe-area';
import { readEnv } from '@/lib/env';
import { colors, radius, spacing } from '@/theme/tokens';

const CHANNELS = [
  { id: 'email', label: 'Email' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'call', label: 'Call' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'send', label: 'Send' },
  { id: 'other', label: 'Other' },
] as const;

export default function CaptureWizardScreen() {
  const params = useLocalSearchParams<{ exchange?: string; slug?: string; draftId?: string }>();
  const { session } = useAuth();
  const insets = useAppInsets();
  const [draft, setDraft] = useState<CaptureWizardDraft>(EMPTY_CAPTURE_DRAFT);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [exchanges, setExchanges] = useState<InboundExchange[]>([]);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<ContextGenerationStatus>('idle');
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [loadingExchanges, setLoadingExchanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestRef = useRef(0);
  const generationKickoffRef = useRef('');
  const hydratedRef = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const updateDraft = useCallback((changes: Partial<CaptureWizardDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...changes };
      const unchanged = (Object.keys(changes) as Array<keyof CaptureWizardDraft>).every(
        (key) => Object.is(current[key], next[key]),
      );
      return unchanged ? current : next;
    });
  }, []);

  const handleTranscriptChange = useCallback((transcript: string) => {
    updateDraft({ transcript });
  }, [updateDraft]);

  const handleDurationChange = useCallback((durationSeconds: number) => {
    updateDraft({ durationSeconds });
  }, [updateDraft]);

  const handleRecordingUriChange = useCallback((recordingUri: string, recordingSource: 'recorded' | 'imported') => {
    updateDraft({ recordingUri, recordingSource });
  }, [updateDraft]);

  const handleRecorderError = useCallback((recorderError: string) => {
    setError(recorderError);
  }, []);

  const generateMeetingContext = useCallback(async (transcript: string, requestId?: number) => {
    const clean = normalizeTranscriptForExtraction(transcript.trim());
    if (clean.length < 20) {
      setUncertainFields([]);
      setGenerationStatus('idle');
      return;
    }

    if (!session?.access_token) {
      setGenerationStatus('error');
      setGenerationError('Sign in to generate meeting context from your transcript.');
      return;
    }

    const activeRequest = requestId ?? requestRef.current + 1;
    if (!requestId) requestRef.current = activeRequest;
    setExtracting(true);
    setGenerationStatus('generating');
    setGenerationStartedAt(Date.now());
    setGenerationError('');
    setError('');

    const hints = draftRef.current;

    try {
      const result = await extractEncounterDraft(session.access_token, clean, {
        personName: hints.personName,
        personEmail: hints.personEmail,
        personPhone: hints.personPhone,
      });
      if (activeRequest !== requestRef.current) return;

      setDraft((current) => {
        const extracted = applyExtractionDraft(current, result.draft!, { replace: true });
        return {
          ...current,
          ...extracted,
          personName: current.personAcknowledged && current.personName.trim()
            ? current.personName
            : extracted.personName,
          personEmail: current.personAcknowledged ? current.personEmail : current.personEmail,
          personPhone: current.personPhone,
          personLinkedIn: current.personLinkedIn,
        };
      });
      setUncertainFields(result.uncertainFields ?? []);
      setGenerationStatus('ready');
    } catch (caught) {
      if (activeRequest !== requestRef.current) return;
      setGenerationStatus('error');
      setGenerationError(
        caught instanceof Error ? caught.message : 'Could not generate meeting context right now.',
      );
    } finally {
      if (activeRequest === requestRef.current) setExtracting(false);
    }
  }, [session?.access_token]);

  const transcribeFromServer = useCallback(async (uri: string) => {
    if (!session?.access_token) {
      setError('Sign in to transcribe recordings and sync capture with web.');
      return null;
    }
    setError('');
    try {
      const result = await transcribeEncounterAudio(session.access_token, uri);
      if (result.transcript) return result.transcript;
      if (result.unavailable === 'ai_not_configured') {
        setError('Server transcription is not configured. Paste a transcript manually for now.');
      }
      return null;
    } catch (transcribeError) {
      setError(transcribeError instanceof Error ? transcribeError.message : 'Could not transcribe this recording.');
      return null;
    }
  }, [session?.access_token]);

  const recorder = useCaptureRecorder({
    transcript: draft.transcript,
    onTranscriptChange: handleTranscriptChange,
    onDurationChange: handleDurationChange,
    onRecordingUriChange: handleRecordingUriChange,
    onError: handleRecorderError,
    transcribeFromServer,
  });

  const captureHasProgress = hasCaptureDraftProgress(draft)
    || recorder.recordingState === 'recording'
    || recorder.recordingState === 'paused';

  const requestLeave = useCallback(() => {
    if (captureHasProgress) {
      setLeaveSheetOpen(true);
      return;
    }
    router.replace('/capture');
  }, [captureHasProgress]);

  const confirmLeave = useCallback(async () => {
    setLeaveSheetOpen(false);
    await recorder.resetRecording();
    await deleteCaptureDraft(draftRef.current.encounterId);
    router.replace('/capture');
  }, [recorder]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (leaveSheetOpen) {
          setLeaveSheetOpen(false);
          return true;
        }
        if (captureHasProgress) {
          setLeaveSheetOpen(true);
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [captureHasProgress, leaveSheetOpen]),
  );

  useEffect(() => {
    if (!draftReady || draft.step !== 1) return;
    const clean = draft.transcript.trim();
    if (clean.length < 20) return;
    if (generationStatus === 'generating' || generationStatus === 'ready') return;

    const kickoffKey = `${draft.encounterId}:${clean.length}`;
    if (generationKickoffRef.current === kickoffKey) return;
    generationKickoffRef.current = kickoffKey;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    void generateMeetingContext(clean, requestId);
  }, [draft.encounterId, draft.step, draft.transcript, draftReady, generateMeetingContext, generationStatus]);

  useEffect(() => {
    void removeExpiredLocalRecordings();
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      try {
        const stored = params.draftId
          ? await readCaptureDraft(String(params.draftId))
          : await readCaptureDraft();
        const next = { ...(stored ?? createFreshCaptureDraft()) };
        if (params.exchange) next.exchangeId = String(params.exchange);
        if (params.slug && readEnv()) {
          const name = await fetchPublicCardName(readEnv()!.publicCardBaseUrl, String(params.slug));
          if (name && !next.personName) next.personName = name;
        }
        if (!stored) await writeCaptureDraft(next);
        setDraft(next);
      } finally {
        setDraftReady(true);
      }
    })();
  }, [params.draftId, params.exchange, params.slug]);

  useEffect(() => {
    if (!draftReady) return;
    void writeCaptureDraft(draft);
  }, [draft, draftReady]);

  useEffect(() => {
    if (!draftReady) return;
    const uri = draft.recordingUri || recorder.recordingUri;
    if (!uri || recorder.recordingState === 'recording') return;

    void saveLocalRecording(draft.encounterId, uri, {
      durationSeconds: draft.durationSeconds || recorder.seconds,
      source: draft.recordingSource || recorder.recordingSource || 'recorded',
      retention: draft.retention,
    }).catch(() => {
      // local persistence is best-effort during capture
    });
  }, [
    draft.durationSeconds,
    draft.encounterId,
    draft.recordingSource,
    draft.recordingUri,
    draft.retention,
    draftReady,
    recorder.recordingSource,
    recorder.recordingState,
    recorder.recordingUri,
    recorder.seconds,
  ]);

  useEffect(() => {
    if (!session?.access_token || draft.step !== 1) return;

    let cancelled = false;
    const loadExchanges = () => {
      setLoadingExchanges(true);
      void fetchInboundExchanges(session.access_token!)
        .then((items) => {
          if (!cancelled) setExchanges(items);
        })
        .catch(() => {
          if (!cancelled) setExchanges([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingExchanges(false);
        });
    };

    loadExchanges();
    const timer = setInterval(loadExchanges, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [draft.step, session?.access_token]);

  useEffect(() => {
    if (!params.exchange || !exchanges.length) return;
    const match = exchanges.find((item) => item.id === params.exchange);
    if (match) linkExchange(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges, params.exchange]);

  function linkExchange(exchange: InboundExchange) {
    setDraft((current) => {
      if (current.exchangeId === exchange.id) return current;
      return {
        ...current,
        exchangeId: exchange.id,
        personName: exchange.visitor_name || current.personName,
        personEmail: exchange.visitor_email || current.personEmail,
        personPhone: exchange.visitor_phone || current.personPhone,
        personAcknowledged: true,
      };
    });
  }

  async function finishRecordingAndGather() {
    setError('');
    if (!draft.consent) {
      setError('Confirm that everyone agreed before continuing.');
      return;
    }
    if (recorder.recordingState === 'recording' || recorder.recordingState === 'paused') {
      await recorder.stopRecording();
    }
    generationKickoffRef.current = '';
    updateDraft({ step: 1 });
  }

  function continueFromRecord(skipRecording = false) {
    setError('');
    if (!draft.consent) {
      setError('Confirm that everyone agreed before continuing.');
      return;
    }
    if (!skipRecording && (recorder.recordingState === 'recording' || recorder.recordingState === 'paused')) {
      setError('Tap Finish recording when you are done — there is no time limit.');
      return;
    }
    generationKickoffRef.current = '';
    updateDraft({ step: 1 });
  }

  function continueFromGather() {
    setError('');
    if (generationStatus === 'generating') return;
    if (!draft.transcript.trim()) {
      setError('Record or add a transcript before reviewing context.');
      return;
    }
    updateDraft({ step: 2 });
  }

  async function ensureAuth(): Promise<string | null> {
    if (session?.access_token) return session.access_token;
    await writeCaptureDraft(draft);
    await setAuthReturnPath('/capture/new');
    router.push('/auth');
    return null;
  }

  function continueFromContext() {
    setError('');
    if (!draft.personName.trim()) {
      setError('Add who you met before continuing.');
      return;
    }
    if (!draft.title.trim() && !draft.sharedSummary.trim() && !draft.privateNotes.trim()) {
      setError('Add a meeting title or a short note about what you discussed.');
      return;
    }
    updateDraft({ step: 3 });
  }

  async function saveAndReview(skipFollowUp = false) {
    const token = await ensureAuth();
    if (!token) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      let recording;
      const recordingUri = draft.recordingUri || recorder.recordingUri;
      if (recordingUri) {
        recording = await saveLocalRecording(draft.encounterId, recordingUri, {
          durationSeconds: draft.durationSeconds || recorder.seconds,
          source: draft.recordingSource || recorder.recordingSource || 'recorded',
          retention: draft.retention,
        });
      }

      const payload = buildEncounterPayload({
        id: draft.encounterId,
        transcript: draft.transcript,
        title: draft.title,
        personName: draft.personName,
        personEmail: draft.personEmail,
        contactId: draft.contactId || undefined,
        exchangeId: draft.exchangeId || undefined,
        sharedSummary: draft.sharedSummary,
        privateNotes: draft.privateNotes,
        followUp: skipFollowUp ? '' : draft.followUp,
        followUpType: draft.followUpType,
        dueAt: draft.dueAt,
        consentMethod: draft.consentMethod,
        status: 'draft',
        durationSeconds: draft.durationSeconds || recorder.seconds,
        recording,
      });
      await saveEncounter(token, payload);
      if (recording?.localUri) {
        try {
          await uploadEncounterRecording(token, payload.id, recording.localUri, recording.mimeType);
          if (draft.retention === 'after_transcription') {
            await deleteLocalRecording(draft.encounterId);
          }
        } catch {
          // sharing still works without uploaded audio
        }
      }
      await deleteCaptureDraft(draft.encounterId);
      router.replace(`/capture/${payload.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this meeting.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2, paddingBottom: insets.bottom }]}>
      {!draftReady ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.ink} size="large" />
          <Text style={styles.loadingCopy}>Loading capture…</Text>
        </View>
      ) : (
      <View style={styles.page}>
        <View style={styles.header}>
          <PageHeader eyebrow="Capture context" title="What mattered in this meeting?" titleStyle={styles.title} onBack={requestLeave} />
        </View>

        <View style={styles.stepperWrap}>
          <CaptureStepIndicator current={draft.step} onStep={(step) => updateDraft({ step })} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {draft.step === 0 ? (
            <CaptureRecordStep
              consent={draft.consent}
              consentMethod={draft.consentMethod}
              onConsentChange={(value) => updateDraft({ consent: value })}
              onConsentMethodChange={(value) => updateDraft({ consentMethod: value })}
              recorder={recorder}
              signedIn={Boolean(session?.access_token)}
            />
          ) : null}

          {draft.step === 1 ? (
            <CaptureGatherStep
              draft={draft}
              onDraftChange={updateDraft}
              generationStatus={generationStatus}
              generationStartedAt={generationStartedAt}
              generationError={generationError}
              onDismissReady={() => setGenerationStatus('idle')}
              exchanges={exchanges}
              loadingExchanges={loadingExchanges}
              signedIn={Boolean(session?.access_token)}
              onLinkExchange={linkExchange}
              onEnsureAuth={ensureAuth}
            />
          ) : null}

          {draft.step === 2 ? (
            <CaptureContextStep
              draft={draft}
              onDraftChange={updateDraft}
              refreshing={extracting}
              onRefresh={() => {
                generationKickoffRef.current = '';
                setGenerationStatus('idle');
                void generateMeetingContext(draft.transcript.trim());
              }}
              uncertainFields={uncertainFields}
            />
          ) : null}

          {draft.step === 3 ? (
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <PaperPlaneTilt size={18} color={colors.ink} weight="bold" />
                <Text style={styles.blockTitle}>What happens next?</Text>
              </View>
              <Body>Add an optional follow-up, then save and review before anything is shared.</Body>
              <Text style={styles.label}>Follow-up action</Text>
              <TextInput
                value={draft.followUp}
                onChangeText={(value) => updateDraft({ followUp: value })}
                placeholder="Send the deck by Friday"
                placeholderTextColor={colors.muted}
                multiline
                scrollEnabled
                style={[styles.input, styles.notesField]}
              />
              <Text style={styles.label}>Channel</Text>
              <View style={styles.channelRow}>
                {CHANNELS.map((channel) => (
                  <Pressable
                    key={channel.id}
                    accessibilityRole="button"
                    onPress={() => updateDraft({ followUpType: channel.id })}
                    style={[styles.channelChip, draft.followUpType === channel.id && styles.channelChipActive]}>
                    <Text style={[styles.channelText, draft.followUpType === channel.id && styles.channelTextActive]}>
                      {channel.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Due date (optional)</Text>
              <TextInput
                value={draft.dueAt}
                onChangeText={(value) => updateDraft({ dueAt: value })}
                placeholder="2026-07-30"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          ) : null}

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {draft.step > 0 ? (
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => updateDraft({ step: draft.step - 1 })}>
              Back
            </Button>
          ) : null}
          {draft.step === 0 ? (
            <>
              {draft.consent && recorder.recordingState === 'idle' && !recorder.recordingUri ? (
                <Button variant="secondary" style={{ flex: 1 }} onPress={() => continueFromRecord(true)}>
                  Skip recording
                </Button>
              ) : null}
              {recorder.recordingState === 'recording' || recorder.recordingState === 'paused' ? (
                <Button style={{ flex: 1 }} onPress={() => void finishRecordingAndGather()}>
                  Finish recording
                </Button>
              ) : (
                <Button
                  style={{ flex: 1 }}
                  onPress={() => continueFromRecord(false)}
                  disabled={!draft.consent || (!recorder.recordingComplete && !draft.transcript.trim())}>
                  {recorder.recordingComplete || draft.transcript.trim() ? 'Next: gather context' : 'Continue'}
                </Button>
              )}
            </>
          ) : null}
          {draft.step === 1 ? (
            <Button
              style={{ flex: 1 }}
              onPress={continueFromGather}
              disabled={generationStatus === 'generating'}>
              {generationStatus === 'ready'
                ? 'Review context'
                : generationStatus === 'error'
                  ? 'Continue anyway'
                  : 'Waiting for context…'}
            </Button>
          ) : null}
          {draft.step === 2 ? (
            <Button style={{ flex: 1 }} onPress={continueFromContext}>
              Continue
            </Button>
          ) : null}
          {draft.step === 3 ? (
            <>
              <Button variant="secondary" style={{ flex: 1 }} loading={saving} onPress={() => void saveAndReview(true)}>
                Save without follow-up
              </Button>
              <Button style={{ flex: 1 }} loading={saving} onPress={() => void saveAndReview(false)}>
                Save and review
              </Button>
            </>
          ) : null}
        </View>
      </View>
      )}
      <CaptureLeaveSheet
        visible={leaveSheetOpen}
        onStay={() => setLeaveSheetOpen(false)}
        onDiscard={() => void confirmLeave()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x3,
  },
  loadingCopy: { color: colors.muted, fontSize: 14 },
  page: { flex: 1 },
  header: { paddingHorizontal: spacing.x5 },
  title: { fontSize: 30, lineHeight: 32 },
  stepperWrap: { marginTop: spacing.x5, paddingHorizontal: spacing.x5 },
  scroll: { flex: 1, marginTop: spacing.x4 },
  scrollContent: { paddingHorizontal: spacing.x5, paddingBottom: spacing.x6, gap: spacing.x4 },
  block: {
    gap: spacing.x4,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  blockTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  sourcePanel: {
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sourceToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  sourceCopy: { flex: 1, gap: 2 },
  sourceHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  fieldHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: 15,
  },
  textarea: { height: 140, maxHeight: 140, paddingTop: spacing.x3, textAlignVertical: 'top' },
  notesField: { height: 140, maxHeight: 140, paddingTop: spacing.x3, textAlignVertical: 'top' },
  transcriptField: { height: 220, maxHeight: 220, paddingTop: spacing.x3, textAlignVertical: 'top' },
  draftNote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  uncertain: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  extractRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  extractCopy: { color: colors.muted, fontSize: 12 },
  exchangeList: { gap: spacing.x3 },
  exchangeCard: {
    gap: spacing.x1,
    padding: spacing.x4,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  exchangeCardSelected: {
    borderColor: colors.ink,
    backgroundColor: colors.surfaceMuted,
  },
  exchangeName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  exchangeMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  exchangeSelected: { color: colors.ink, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  channelChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
  },
  channelChipActive: { backgroundColor: colors.accent },
  channelText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  channelTextActive: { fontWeight: '900' },
  success: { color: '#2F5711', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
    paddingHorizontal: spacing.x5,
    paddingTop: spacing.x3,
    paddingBottom: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.canvas,
  },
});
