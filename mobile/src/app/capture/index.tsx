import { router, useLocalSearchParams } from 'expo-router';
import { CaretDown, CaretUp, IdentificationCard, PaperPlaneTilt, Sparkle } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CaptureRecordStep } from '@/components/capture-record-step';
import { CaptureStepIndicator } from '@/components/capture-step-indicator';
import { Body, Button, PageHeader } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  clearCaptureDraft,
  createFreshCaptureDraft,
  EMPTY_CAPTURE_DRAFT,
  readCaptureDraft,
  setAuthReturnPath,
  writeCaptureDraft,
  type CaptureWizardDraft,
} from '@/features/encounters/capture-draft';
import {
  applyExtractionDraft,
  EXTRACTION_DRAFT_NOTE,
} from '@/features/encounters/extraction-helpers';
import {
  buildEncounterPayload,
  extractEncounterDraft,
  fetchInboundExchanges,
  fetchPublicCardName,
  saveEncounter,
  transcribeEncounterAudio,
  type InboundExchange,
} from '@/features/encounters/encounter-api';
import {
  deleteLocalRecording,
  removeExpiredLocalRecordings,
  saveLocalRecording,
} from '@/features/encounters/local-recordings';
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
  const params = useLocalSearchParams<{ exchange?: string; slug?: string }>();
  const { session } = useAuth();
  const insets = useAppInsets();
  const [draft, setDraft] = useState<CaptureWizardDraft>(EMPTY_CAPTURE_DRAFT);
  const [exchanges, setExchanges] = useState<InboundExchange[]>([]);
  const [draftSource, setDraftSource] = useState<'ai' | 'heuristic' | ''>('');
  const [draftMessage, setDraftMessage] = useState('');
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [loadingExchanges, setLoadingExchanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sourceOpen, setSourceOpen] = useState(true);
  const requestRef = useRef(0);
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
      const message = 'Add or record more transcript before generating meeting context.';
      setDraftMessage(message);
      setDraftSource('');
      setUncertainFields([]);
      return;
    }

    const activeRequest = requestId ?? requestRef.current + 1;
    if (!requestId) requestRef.current = activeRequest;
    setExtracting(true);
    setError('');

    try {
      if (session?.access_token) {
        const result = await extractEncounterDraft(
          session.access_token,
          clean,
          draftRef.current.personName,
        );
        if (activeRequest !== requestRef.current) return;

        setDraft((current) => ({
          ...current,
          ...applyExtractionDraft(current, result.draft!, { replace: true }),
        }));
        const note = EXTRACTION_DRAFT_NOTE[result.source || 'heuristic'];
        setDraftMessage(note);
        setDraftSource(result.source || 'heuristic');
        setUncertainFields([]);
      }
    } catch {
      if (activeRequest !== requestRef.current) return;
    } finally {
      if (activeRequest === requestRef.current) setExtracting(false);
    }
  }, [session?.access_token]);

  const handleTranscriptFinalized = useCallback((cleanTranscript: string) => {
    if (cleanTranscript.trim().length >= 20) {
      void generateMeetingContext(cleanTranscript);
    }
  }, [generateMeetingContext]);

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
    onTranscriptFinalized: handleTranscriptFinalized,
    transcribeFromServer,
  });

  useEffect(() => {
    const clean = draft.transcript.trim();
    if (!draftReady || clean.length < 20) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const timer = setTimeout(() => {
      void generateMeetingContext(clean, requestId);
    }, 650);

    return () => clearTimeout(timer);
  }, [draft.transcript, draftReady, generateMeetingContext]);

  useEffect(() => {
    void removeExpiredLocalRecordings();
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      try {
        const stored = await readCaptureDraft();
        const next = { ...(stored ?? createFreshCaptureDraft()) };
        if (params.exchange) next.exchangeId = String(params.exchange);
        if (params.slug && readEnv()) {
          const name = await fetchPublicCardName(readEnv()!.publicCardBaseUrl, String(params.slug));
          if (name && !next.personName) next.personName = name;
        }
        setDraft(next);
      } finally {
        setDraftReady(true);
      }
    })();
  }, [params.exchange, params.slug]);

  useEffect(() => {
    if (!draftReady) return;
    void writeCaptureDraft(draft);
  }, [draft, draftReady]);

  useEffect(() => {
    if (!session?.access_token || draft.step < 2) return;
    setLoadingExchanges(true);
    void fetchInboundExchanges(session.access_token)
      .then(setExchanges)
      .catch(() => setExchanges([]))
      .finally(() => setLoadingExchanges(false));
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
      };
    });
  }

  function clearLink() {
    updateDraft({ exchangeId: '', contactId: '', personEmail: '' });
  }

  async function ensureAuth(): Promise<string | null> {
    if (session?.access_token) return session.access_token;
    await writeCaptureDraft(draft);
    await setAuthReturnPath('/capture');
    router.push('/auth');
    return null;
  }

  function continueFromRecord(skipRecording = false) {
    setError('');
    if (!draft.consent) {
      setError('Confirm that everyone agreed before continuing.');
      return;
    }
    if (!skipRecording && (recorder.recordingState === 'recording' || recorder.recordingState === 'paused')) {
      setError('Finish the recording before moving to meeting context.');
      return;
    }
    if (draft.transcript.trim()) void generateMeetingContext(draft.transcript.trim());
    else if (skipRecording) {
      setMessage('Add notes on the next step, or come back after recording.');
    }
    updateDraft({ step: 1 });
  }

  function continueFromContext() {
    setError('');
    if (!draft.personName.trim()) {
      setError('Start with who you met — add their name.');
      return;
    }
    if (!draft.title.trim() && !draft.sharedSummary.trim() && !draft.privateNotes.trim()) {
      setError('Add a meeting title or a short note about what you discussed.');
      return;
    }
    updateDraft({ step: 2 });
  }

  function continueFromConnect() {
    setError('');
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
        if (draft.retention === 'after_transcription') {
          await deleteLocalRecording(draft.encounterId);
        }
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
      await clearCaptureDraft();
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
          <PageHeader eyebrow="Capture context" title="What mattered in this meeting?" titleStyle={styles.title} />
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
              draftMessage={draftMessage}
              extracting={extracting}
              uncertainFields={uncertainFields}
            />
          ) : null}

          {draft.step === 1 ? (
            <View style={styles.block}>
              {draft.transcript.trim() ? (
                <View style={styles.sourcePanel}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSourceOpen((value) => !value)}
                    style={styles.sourceToggle}>
                    <View style={styles.sourceCopy}>
                      <Text style={styles.blockTitle}>Source transcript</Text>
                      <Text style={styles.sourceHint}>Reference what was said while you edit the summary.</Text>
                    </View>
                    {sourceOpen ? <CaretUp size={16} color={colors.ink} weight="bold" /> : <CaretDown size={16} color={colors.ink} weight="bold" />}
                  </Pressable>
                  {sourceOpen ? (
                    <TextInput
                      value={draft.transcript}
                      onChangeText={(value) => updateDraft({ transcript: value })}
                      multiline
                      style={[styles.input, styles.textarea]}
                    />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.blockHead}>
                <Sparkle size={18} color={colors.ink} weight="fill" />
                <Text style={styles.blockTitle}>Who did you meet?</Text>
              </View>
              <Body>Suggested drafts are starting points — edit anything before you save.</Body>
              {draftMessage ? (
                <Text style={styles.draftNote}>
                  {draftSource === 'ai' ? 'AI draft' : 'Suggested draft'} — {draftMessage}
                  {extracting ? ' Generating…' : ''}
                </Text>
              ) : null}
              {uncertainFields.length > 0 ? (
                <Text style={styles.uncertain}>Double-check: {uncertainFields.join(', ')}</Text>
              ) : null}
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={draft.personName}
                onChangeText={(value) => updateDraft({ personName: value })}
                placeholder="Who did you meet?"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Meeting title</Text>
              <TextInput
                value={draft.title}
                onChangeText={(value) => updateDraft({ title: value })}
                placeholder="Coffee with Alex"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Private notes</Text>
              <TextInput
                value={draft.privateNotes}
                onChangeText={(value) => updateDraft({ privateNotes: value })}
                multiline
                style={[styles.input, styles.textarea]}
              />
              <Text style={styles.label}>Shared summary</Text>
              <TextInput
                value={draft.sharedSummary}
                onChangeText={(value) => updateDraft({ sharedSummary: value })}
                multiline
                style={[styles.input, styles.textarea]}
              />
              {draft.transcript.trim() ? (
                <Button variant="secondary" loading={extracting} onPress={() => void generateMeetingContext(draft.transcript.trim())}>
                  Regenerate draft
                </Button>
              ) : null}
              {extracting ? (
                <View style={styles.extractRow}>
                  <ActivityIndicator color={colors.ink} />
                  <Text style={styles.extractCopy}>Suggesting context…</Text>
                </View>
              ) : draftSource ? (
                <View style={styles.extractRow}>
                  <Sparkle size={16} color={colors.ink} weight="fill" />
                  <Text style={styles.extractCopy}>
                    {draftSource === 'ai' ? 'AI suggestions ready' : 'Smart suggestions ready'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {draft.step === 2 ? (
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <IdentificationCard size={18} color={colors.ink} weight="bold" />
                <Text style={styles.blockTitle}>Connect their details</Text>
              </View>
              <Body>Link this moment to someone who shared your card, or continue without linking.</Body>
              {!session ? (
                <Button onPress={() => void ensureAuth()}>Sign in to load inbound captures</Button>
              ) : loadingExchanges ? (
                <ActivityIndicator color={colors.ink} />
              ) : exchanges.length ? (
                <View style={styles.exchangeList}>
                  {exchanges.map((exchange) => {
                    const selected = draft.exchangeId === exchange.id;
                    return (
                      <Pressable
                        key={exchange.id}
                        accessibilityRole="button"
                        onPress={() => linkExchange(exchange)}
                        style={[styles.exchangeCard, selected && styles.exchangeCardSelected]}>
                        <Text style={styles.exchangeName}>{exchange.visitor_name || 'Unknown visitor'}</Text>
                        <Text style={styles.exchangeMeta}>
                          {[exchange.visitor_role, exchange.visitor_company].filter(Boolean).join(' · ') || exchange.visitor_email}
                        </Text>
                        {selected ? <Text style={styles.exchangeSelected}>Linked</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyCopy}>No new inbound captures yet. You can still save this meeting.</Text>
              )}
              {draft.exchangeId ? (
                <Button variant="ghost" onPress={clearLink}>Clear link</Button>
              ) : null}
            </View>
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
                style={[styles.input, styles.textarea]}
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
              <Button
                style={{ flex: 1 }}
                onPress={() => continueFromRecord(false)}
                disabled={!draft.consent || recorder.recordingState === 'recording' || recorder.recordingState === 'paused'}>
                {recorder.recordingComplete ? 'Next: meeting context' : 'Continue'}
              </Button>
            </>
          ) : null}
          {draft.step === 1 ? (
            <Button style={{ flex: 1 }} onPress={continueFromContext}>
              Continue
            </Button>
          ) : null}
          {draft.step === 2 ? (
            <Button style={{ flex: 1 }} onPress={continueFromConnect}>
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
  textarea: { minHeight: 110, paddingTop: spacing.x3, textAlignVertical: 'top' },
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
