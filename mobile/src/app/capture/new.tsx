import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PaperPlaneTilt } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CaptureErrorSheet } from '@/components/capture-error-sheet';
import { CaptureInteractionStep } from '@/components/capture-interaction-step';
import { CaptureLeaveSheet } from '@/components/capture-leave-sheet';
import { FollowUpDuePicker } from '@/components/follow-up-due-picker';
import { CaptureStepIndicator } from '@/components/capture-step-indicator';
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
  fetchAllConnectionsMerged,
  type ConnectionItem,
} from '@/features/connections/connections-api';
import {
  createGatherPerson,
  formatPeopleNames,
  hasValidGatherPeople,
  personFromExchange,
  syncLegacyPersonFields,
  MAX_GATHER_PEOPLE,
} from '@/features/encounters/gather-people';
import {
  removeExpiredLocalRecordings,
  readLocalRecordingMetadata,
  saveLocalRecording,
  updateLocalRecordingSharedUrl,
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
import { fetchEncounterRecords } from '@/features/follow-ups/follow-up-api';
import {
  FOLLOW_UP_CHANNELS,
  toggleFollowUpChannel,
} from '@/features/follow-ups/follow-up-channels';
import { useCaptureRecorder, type ImportRecordingMeta } from '@/features/encounters/use-capture-recorder';
import { normalizeTranscriptForExtraction } from '@/lib/transcript-cleanup';
import { useAppInsets } from '@/lib/safe-area';
import { readEnv } from '@/lib/env';
import { colors, radius, spacing } from '@/theme/tokens';

type GenerationStatus = 'idle' | 'generating' | 'error';

export default function CaptureWizardScreen() {
  const params = useLocalSearchParams<{ exchange?: string; slug?: string; draftId?: string }>();
  const { session } = useAuth();
  const insets = useAppInsets();
  const [draft, setDraft] = useState<CaptureWizardDraft>(EMPTY_CAPTURE_DRAFT);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [exchanges, setExchanges] = useState<InboundExchange[]>([]);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [generationError, setGenerationError] = useState('');
  const [loadingExchanges, setLoadingExchanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [message, setMessage] = useState('');
  const requestRef = useRef(0);
  const generationKickoffRef = useRef('');
  const generationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWriteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedErrorRef = useRef('');
  const hydratedRef = useRef(false);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [priorMeetingCounts, setPriorMeetingCounts] = useState<Record<string, number>>({});
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

  const getPriorMeetingCount = useCallback((email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return 0;
    return priorMeetingCounts[normalized] ?? 0;
  }, [priorMeetingCounts]);

  function resolveContactIdForDraft(current: CaptureWizardDraft) {
    const email = current.personEmail.trim().toLowerCase();
    const exchangeId = current.exchangeId?.trim();
    const match = connections.find((connection) => (
      (email && connection.email?.trim().toLowerCase() === email)
      || (exchangeId && connection.source === 'inbound' && connection.sourceId === exchangeId)
    ));
    return match?.id || current.contactId || '';
  }

  const handleTranscriptChange = useCallback((transcript: string) => {
    updateDraft({ transcript });
  }, [updateDraft]);

  const handleDurationChange = useCallback((durationSeconds: number) => {
    updateDraft({ durationSeconds });
  }, [updateDraft]);

  const handleRecordingUriChange = useCallback((
    recordingUri: string,
    recordingSource: 'recorded' | 'imported',
    meta?: ImportRecordingMeta,
  ) => {
    updateDraft({
      recordingUri,
      recordingSource,
      importFileName: meta?.fileName || '',
      importMimeType: meta?.mimeType || '',
    });
  }, [updateDraft]);

  const showCaptureError = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (dismissedErrorRef.current === trimmed) return;
    setError(trimmed);
    setErrorSheetOpen(true);
  }, []);

  const closeErrorSheet = useCallback(() => {
    if (error.trim()) {
      dismissedErrorRef.current = error.trim();
    }
    setErrorSheetOpen(false);
    setError('');
  }, [error]);

  const handleImportStarted = useCallback(() => {
    dismissedErrorRef.current = '';
    setError('');
    setErrorSheetOpen(false);
  }, []);

  const handleRecorderError = useCallback((recorderError: string) => {
    if (!recorderError.trim()) {
      setError('');
      return;
    }
    showCaptureError(recorderError);
  }, [showCaptureError]);

  const generateMeetingContext = useCallback(async (transcript: string, requestId?: number) => {
    const clean = normalizeTranscriptForExtraction(transcript.trim());
    if (clean.length < 20) {
      setUncertainFields([]);
      setGenerationStatus('idle');
      return;
    }

    if (!session?.access_token) {
      setGenerationStatus('error');
      const signInMessage = 'Sign in to generate meeting context from your transcript.';
      setGenerationError(signInMessage);
      showCaptureError(signInMessage);
      return;
    }

    const activeRequest = requestId ?? requestRef.current + 1;
    if (!requestId) requestRef.current = activeRequest;
    setExtracting(true);
    setGenerationStatus('generating');
    setGenerationError('');
    setError('');

    const hints = draftRef.current;

    try {
      const result = await extractEncounterDraft(session.access_token, clean, {
        personName: formatPeopleNames(hints.people) || hints.personName,
        personEmail: hints.personEmail,
        personPhone: hints.personPhone,
        people: (hints.people ?? []).map((person) => ({
          name: person.name,
          email: person.email,
          phone: person.phone,
        })),
      });
      if (activeRequest !== requestRef.current) return;

      setDraft((current) => {
        const extracted = applyExtractionDraft(current, result.draft!, { replace: true });
        return {
          ...current,
          ...extracted,
        };
      });
      setUncertainFields(result.uncertainFields ?? []);
      setGenerationStatus('idle');
    } catch (caught) {
      if (activeRequest !== requestRef.current) return;
      const message = caught instanceof Error ? caught.message : 'Could not generate meeting context right now.';
      setGenerationStatus('error');
      setGenerationError(message);
      showCaptureError(message);
    } finally {
      if (activeRequest === requestRef.current) setExtracting(false);
    }
  }, [session?.access_token, showCaptureError]);

  const handleTranscriptFinalized = useCallback((transcriptValue: string) => {
    const clean = normalizeTranscriptForExtraction(transcriptValue.trim());
    if (clean.length < 20) return;
    if (draftRef.current.step >= 1 && generationStatus !== 'generating') {
      generationKickoffRef.current = '';
      void generateMeetingContext(clean);
    }
  }, [generateMeetingContext, generationStatus]);

  const transcribeFromServer = useCallback(async (uri: string, meta?: ImportRecordingMeta) => {
    if (!session?.access_token) {
      throw new Error('Sign in to auto-transcribe this recording, or paste what was said.');
    }
    const fileName = meta?.fileName || draftRef.current.importFileName || undefined;
    const mimeType = meta?.mimeType || draftRef.current.importMimeType || undefined;
    const result = await transcribeEncounterAudio(session.access_token, uri, { fileName, mimeType });
    if (result.transcript) return result.transcript;
    throw new Error('Could not transcribe this recording. Paste or type what was said.');
  }, [session?.access_token]);

  const goToStep = useCallback((step: number) => {
    updateDraft({ step: Math.max(0, Math.min(2, step)) });
  }, [updateDraft]);

  const handleImportReady = useCallback(() => {
    if (!draftRef.current.gatherSessionStartedAt) {
      updateDraft({ gatherSessionStartedAt: new Date().toISOString() });
    }
  }, [updateDraft]);

  const recorder = useCaptureRecorder({
    transcript: draft.transcript,
    onTranscriptChange: handleTranscriptChange,
    onDurationChange: handleDurationChange,
    onRecordingUriChange: handleRecordingUriChange,
    onError: handleRecorderError,
    onImportReady: handleImportReady,
    onImportStarted: handleImportStarted,
    onTranscriptFinalized: handleTranscriptFinalized,
    transcribeFromServer,
  });

  const recorderHydratedRef = useRef(false);
  const isTranscribing = recorder.transcriptStatus === 'transcribing'
    || recorder.serverTranscribePhase === 'preparing'
    || recorder.serverTranscribePhase === 'transcribing'
    || recorder.serverTranscribePhase === 'revealing'
    || recorder.isFinishing;

  const sessionExchanges = useMemo(() => {
    const started = draft.gatherSessionStartedAt;
    if (!started) return [];
    const startedMs = Date.parse(started) - 5000;
    return exchanges.filter((exchange) => {
      if (!exchange.created_at) return false;
      return Date.parse(exchange.created_at) >= startedMs;
    });
  }, [draft.gatherSessionStartedAt, exchanges]);

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

  const saveDraftAndLeave = useCallback(async () => {
    setLeaveSheetOpen(false);
    const current = draftRef.current;
    const next = {
      ...current,
      recordingUri: current.recordingUri || recorder.recordingUri,
      recordingSource: current.recordingSource || recorder.recordingSource || current.recordingSource,
      transcript: current.transcript || recorder.displayTranscript.trim(),
      durationSeconds: current.durationSeconds || recorder.seconds,
    };
    setDraft(next);
    await writeCaptureDraft(next);
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
    if (generationStatus === 'generating') return;

    const kickoffKey = `${draft.encounterId}:${clean.length}:${clean.slice(-80)}`;
    if (generationKickoffRef.current === kickoffKey) return;

    if (generationDebounceRef.current) {
      clearTimeout(generationDebounceRef.current);
    }

    generationDebounceRef.current = setTimeout(() => {
      generationKickoffRef.current = kickoffKey;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      void generateMeetingContext(clean, requestId);
    }, 900);

    return () => {
      if (generationDebounceRef.current) {
        clearTimeout(generationDebounceRef.current);
      }
    };
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
          if (name && !(next.people ?? []).length) {
            next.people = [createGatherPerson({ name })];
            Object.assign(next, syncLegacyPersonFields(next.people));
          }
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
    if (draftWriteDebounceRef.current) {
      clearTimeout(draftWriteDebounceRef.current);
    }
    draftWriteDebounceRef.current = setTimeout(() => {
      void writeCaptureDraft(draft);
    }, 450);
    return () => {
      if (draftWriteDebounceRef.current) {
        clearTimeout(draftWriteDebounceRef.current);
      }
    };
  }, [draft, draftReady]);

  useEffect(() => {
    if (!draftReady || recorderHydratedRef.current) return;
    recorderHydratedRef.current = true;

    recorder.hydrateFromDraft({
      recordingUri: draft.recordingUri,
      recordingSource: draft.recordingSource,
      transcript: draft.transcript,
      durationSeconds: draft.durationSeconds,
    });

    if (draft.recordingUri && draft.transcript.trim().length < 20 && session?.access_token) {
      void recorder.transcribeRecordingIfNeeded(draft.recordingUri);
    }
  }, [draft.durationSeconds, draft.recordingSource, draft.recordingUri, draft.transcript, draftReady, recorder, session?.access_token]);

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
    if (!session?.access_token || draft.step !== 0) return;

    let cancelled = false;
    const loadExchanges = (showLoading = false) => {
      if (showLoading) setLoadingExchanges(true);
      void fetchInboundExchanges(session.access_token!)
        .then((items) => {
          if (!cancelled) setExchanges(items);
        })
        .catch(() => {
          if (!cancelled) setExchanges([]);
        })
        .finally(() => {
          if (!cancelled && showLoading) setLoadingExchanges(false);
        });
    };

    loadExchanges(true);
    const timer = setInterval(() => loadExchanges(false), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [draft.step, session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) {
      setConnections([]);
      setPriorMeetingCounts({});
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetchAllConnectionsMerged(session.access_token),
      fetchEncounterRecords(session.access_token),
    ])
      .then(([nextConnections, encounters]) => {
        if (cancelled) return;
        setConnections(nextConnections);
        const counts: Record<string, number> = {};
        for (const encounter of encounters) {
          const email = encounter.personEmail.trim().toLowerCase();
          if (!email) continue;
          counts[email] = (counts[email] ?? 0) + 1;
        }
        setPriorMeetingCounts(counts);
      })
      .catch(() => {
        if (!cancelled) {
          setConnections([]);
          setPriorMeetingCounts({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!params.exchange || !exchanges.length) return;
    const match = exchanges.find((item) => item.id === params.exchange);
    if (match) linkExchange(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges, params.exchange]);

  function linkExchange(exchange: InboundExchange) {
    setDraft((current) => {
      const people = current.people ?? [];
      if (people.some((person) => person.exchangeId === exchange.id)) return current;
      if (people.length >= MAX_GATHER_PEOPLE) return current;
      return {
        ...current,
        ...syncLegacyPersonFields([...people, personFromExchange(exchange)]),
      };
    });
  }

  async function continueFromInteraction(skipRecording = false) {
    if (!draft.consent) {
      showCaptureError('Confirm that everyone agreed before continuing.');
      return;
    }
    const people = draft.people ?? [];
    if (!hasValidGatherPeople(people)) {
      showCaptureError('Add at least one person you met.');
      return;
    }
    if (!skipRecording && (recorder.recordingState === 'recording' || recorder.recordingState === 'paused')) {
      await recorder.stopRecording();
    } else {
      await recorder.awaitPendingFinish();
    }
    updateDraft({ step: 1 });
  }

  function continueFromContext() {
    if (!draft.title.trim() && !draft.sharedSummary.trim()) {
      dismissedErrorRef.current = '';
      showCaptureError('Add a meeting title or share summary.');
      return;
    }
    updateDraft({ step: 2 });
  }

  const contextNextDisabled =
    isTranscribing
    || (generationStatus === 'generating' && !draft.title.trim() && !draft.sharedSummary.trim());

  const contextNextLoading =
    generationStatus === 'generating' && !draft.title.trim() && !draft.sharedSummary.trim();

  async function ensureAuth(): Promise<string | null> {
    if (session?.access_token) return session.access_token;
    await writeCaptureDraft(draft);
    await setAuthReturnPath('/capture/new');
    router.push('/auth');
    return null;
  }

  async function saveAndReview() {
    const token = await ensureAuth();
    if (!token) return;

    setSaving(true);
    setMessage('');
    try {
      let recording = await readLocalRecordingMetadata(draft.encounterId);
      const recordingUri = draft.recordingUri || recorder.recordingUri;
      if (recordingUri) {
        try {
          recording = await saveLocalRecording(draft.encounterId, recordingUri, {
            durationSeconds: draft.durationSeconds || recorder.seconds,
            source: draft.recordingSource || recorder.recordingSource || 'recorded',
            retention: draft.retention,
          });
        } catch (caught) {
          if (!recording) throw caught;
        }
      }

      if (recording?.localUri) {
        try {
          const uploaded = await uploadEncounterRecording(
            token,
            draft.encounterId,
            recording.localUri,
          );
          recording = {
            ...recording,
            ...uploaded,
            localUri: recording.localUri,
            audioLocation: 'server',
          };
          await updateLocalRecordingSharedUrl(draft.encounterId, uploaded.sharedAudioUrl ?? '');
          // Keep local audio for host playback — cloud copy is only the guest bridge.
        } catch {
          // host keeps local playback; guest sharing retried from review screen
        }
      }

      const payload = buildEncounterPayload({
        id: draft.encounterId,
        transcript: draft.transcript,
        title: draft.title,
        personName: draft.personName,
        personEmail: draft.personEmail,
        people: draft.people,
        contactId: resolveContactIdForDraft(draft) || undefined,
        exchangeId: draft.exchangeId || undefined,
        sharedSummary: draft.sharedSummary,
        privateNotes: draft.privateNotes,
        followUpChannels: draft.followUpChannels,
        dueAt: draft.dueAt,
        consentMethod: draft.consentMethod,
        status: 'draft',
        durationSeconds: draft.durationSeconds || recorder.seconds,
        recording: recording ?? undefined,
      });
      await saveEncounter(token, payload);
      await deleteCaptureDraft(draft.encounterId);
      router.replace(`/capture/${payload.id}`);
    } catch (caught) {
      showCaptureError(caught instanceof Error ? caught.message : 'Could not save this meeting.');
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
          <CaptureStepIndicator current={draft.step} onStep={goToStep} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {draft.step === 0 ? (
            <CaptureInteractionStep
              draft={draft}
              onDraftChange={updateDraft}
              consent={draft.consent}
              consentMethod={draft.consentMethod}
              onConsentChange={(value) => updateDraft({ consent: value })}
              onConsentMethodChange={(value) => updateDraft({ consentMethod: value })}
              recorder={recorder}
              signedIn={Boolean(session?.access_token)}
              exchanges={sessionExchanges}
              loadingExchanges={loadingExchanges}
              onLinkExchange={linkExchange}
              onEnsureAuth={ensureAuth}
              getPriorMeetingCount={getPriorMeetingCount}
              knownConnectionEmails={connections.map((connection) => connection.email?.trim().toLowerCase() || '').filter(Boolean)}
            />
          ) : null}

          {draft.step === 1 ? (
            <CaptureContextStep
              draft={draft}
              onDraftChange={updateDraft}
              refreshing={extracting}
              isGenerating={generationStatus === 'generating'}
              isTranscribing={isTranscribing}
              generationError={generationError}
              onRefresh={() => {
                generationKickoffRef.current = '';
                setGenerationStatus('idle');
                void generateMeetingContext(draft.transcript.trim());
              }}
              uncertainFields={uncertainFields}
            />
          ) : null}

          {draft.step === 2 ? (
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <PaperPlaneTilt size={18} color={colors.ink} weight="bold" />
                <Text style={styles.blockTitle}>What happens next?</Text>
              </View>
              <Body>Pick how you want to follow up, add any private notes, then save and review.</Body>
              {(draft.people ?? []).length > 1 ? (
                <View style={styles.followUpPeopleWrap}>
                  <Text style={styles.label}>Applies to everyone</Text>
                  <Text style={styles.fieldHint}>
                    One reminder per person, tracked separately for each attendee.
                  </Text>
                  <View style={styles.followUpPeopleRow}>
                    {(draft.people ?? []).map((person) => (
                      <View key={person.id} style={styles.followUpPersonChip}>
                        <Text style={styles.followUpPersonChipText}>
                          {person.name.trim() || 'Guest'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              <Text style={styles.label}>Private notes</Text>
              <TextInput
                value={draft.privateNotes}
                onChangeText={(value) => updateDraft({ privateNotes: value })}
                multiline
                scrollEnabled
                placeholder="Anything you want to remember for yourself…"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textarea]}
              />
              <Text style={styles.label}>Follow-up channels</Text>
              <Text style={styles.fieldHint}>Pick as many as you'd like. Each channel becomes its own action.</Text>
              <View style={styles.channelRow}>
                {FOLLOW_UP_CHANNELS.map((channel) => {
                  const selected = draft.followUpChannels.includes(channel.id);
                  return (
                    <Pressable
                      key={channel.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        const next = toggleFollowUpChannel(draft.followUpChannels, channel.id);
                        updateDraft({
                          followUpChannels: next,
                          followUpType: next[0] || 'email',
                        });
                      }}
                      style={[styles.channelChip, selected && styles.channelChipActive]}>
                      <Text style={[styles.channelText, selected && styles.channelTextActive]}>
                        {channel.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <FollowUpDuePicker
                dueAt={draft.dueAt}
                onChange={(dueAt) => updateDraft({ dueAt })}
              />
            </View>
          ) : null}

          {message ? <Text style={styles.success}>{message}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {draft.step > 0 ? (
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => goToStep(draft.step - 1)}>
              Back
            </Button>
          ) : null}
          {draft.step === 0 ? (
            <>
              {draft.consent && recorder.recordingState === 'idle' && !recorder.recordingUri ? (
                <Button variant="secondary" style={{ flex: 1 }} onPress={() => void continueFromInteraction(true)}>
                  Skip recording
                </Button>
              ) : null}
              <Button
                style={{ flex: 1 }}
                onPress={() => void continueFromInteraction(false)}
                loading={isTranscribing}
                disabled={
                  !draft.consent
                  || !hasValidGatherPeople(draft.people ?? [])
                  || isTranscribing
                }>
                {isTranscribing ? 'Transcribing…' : 'Next'}
              </Button>
            </>
          ) : null}
          {draft.step === 1 ? (
            <Button
              style={{ flex: 1 }}
              onPress={continueFromContext}
              disabled={contextNextDisabled}
              loading={contextNextLoading}>
              Next
            </Button>
          ) : null}
          {draft.step === 2 ? (
            <Button style={{ flex: 1 }} loading={saving} onPress={() => void saveAndReview()}>
              Save & review
            </Button>
          ) : null}
        </View>
      </View>
      )}
      <CaptureLeaveSheet
        visible={leaveSheetOpen}
        onStay={() => setLeaveSheetOpen(false)}
        onSaveDraft={() => void saveDraftAndLeave()}
        onDiscard={() => void confirmLeave()}
      />
      <CaptureErrorSheet
        visible={errorSheetOpen}
        message={error}
        onClose={closeErrorSheet}
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
  followUpPeopleWrap: { gap: spacing.x2 },
  followUpPeopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  followUpPersonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  followUpPersonChipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
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
