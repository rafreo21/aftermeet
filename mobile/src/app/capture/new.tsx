import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CloudArrowUp, DeviceMobile, PaperPlaneTilt } from 'phosphor-react-native';
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
import { FollowUpDuePicker } from '@/components/follow-up-due-picker';
import { CaptureStepIndicator } from '@/components/capture-step-indicator';
import { Body, Button, PageHeader } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  createFreshCaptureDraft,
  captureDraftFromRemote,
  captureDraftToRemote,
  deleteCaptureDraft,
  EMPTY_CAPTURE_DRAFT,
  hasCaptureDraftProgress,
  getCaptureDeviceIdentity,
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
  CaptureSessionConflictError,
  extractEncounterDraft,
  fetchInboundExchanges,
  fetchCaptureSessions,
  fetchPublicCardName,
  saveEncounter,
  syncCaptureSession,
  transcribeEncounterAudio,
  uploadEncounterRecording,
  uploadEncounterRecordingToDrive,
  uploadEncounterRecordingToOneDrive,
  type EncounterExtractionCommitment,
  type InboundExchange,
} from '@/features/encounters/encounter-api';
import { fetchConnectedAccounts } from '@/features/integrations/integrations-api';
import { fetchEncounterRecords } from '@/features/follow-ups/follow-up-api';
import {
  FOLLOW_UP_CHANNELS,
  normalizeFollowUpChannels,
  toggleFollowUpChannel,
} from '@/features/follow-ups/follow-up-channels';
import { FOLLOW_UP_TEMPLATES } from '@/features/follow-ups/follow-up-templates';
import { useSharedCaptureRecorder, type ImportRecordingMeta } from '@/features/encounters/capture-recorder-context';
import { normalizeTranscriptForExtraction } from '@/lib/transcript-cleanup';
import { notifyMeetingReviewReady } from '@/features/notifications/notification-service';
import { useAppInsets } from '@/lib/safe-area';
import { readEnv } from '@/lib/env';
import { colors, radius, spacing } from '@/theme/tokens';

type GenerationStatus = 'idle' | 'generating' | 'error';
type CommitmentAssignment = { owner: 'me' | 'guest'; targetName: string };

const CAPTURE_DRAFT_READ_TIMEOUT_MS = 2_000;

async function readCaptureDraftWithoutBlocking(encounterId?: string): Promise<CaptureWizardDraft | null> {
  return Promise.race([
    readCaptureDraft(encounterId),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), CAPTURE_DRAFT_READ_TIMEOUT_MS);
    }),
  ]);
}

function commitmentKey(commitment: EncounterExtractionCommitment, index: number): string {
  return `${index}:${commitment.title}:${commitment.channel}:${commitment.dueAt}`;
}

function defaultCommitmentKeys(commitments: EncounterExtractionCommitment[]): string[] {
  return commitments.flatMap((commitment, index) => commitment.title.trim() ? [commitmentKey(commitment, index)] : []);
}

function initialCommitmentAssignments(
  commitments: EncounterExtractionCommitment[],
  people: Array<{ name: string }>,
): Record<string, CommitmentAssignment> {
  return Object.fromEntries(commitments.map((commitment, index) => {
    const matched = people.find((person) => (
      person.name.trim().toLocaleLowerCase() === commitment.ownerName.trim().toLocaleLowerCase()
    ));
    return [commitmentKey(commitment, index), {
      owner: commitment.owner,
      targetName: (commitment.owner === 'guest' ? matched?.name : people[0]?.name) || commitment.ownerName,
    }];
  }));
}

export default function CaptureWizardScreen() {
  const params = useLocalSearchParams<{
    exchange?: string;
    slug?: string;
    draftId?: string;
    personName?: string;
    personEmail?: string;
    sourceId?: string;
    contactId?: string;
    openConsent?: string;
  }>();
  const { session } = useAuth();
  const insets = useAppInsets();
  const [draft, setDraft] = useState<CaptureWizardDraft>(EMPTY_CAPTURE_DRAFT);
  const captureDeviceRef = useRef<{ id: string; label: string } | null>(null);
  const remoteSyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedDraftAtRef = useRef('');
  const suppressNextRemoteSyncRef = useRef(false);
  const [exchanges, setExchanges] = useState<InboundExchange[]>([]);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [commitmentSuggestions, setCommitmentSuggestions] = useState<EncounterExtractionCommitment[]>([]);
  const [selectedCommitmentKeys, setSelectedCommitmentKeys] = useState<string[]>([]);
  const [commitmentAssignments, setCommitmentAssignments] = useState<Record<string, CommitmentAssignment>>({});
  const [extracting, setExtracting] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [generationError, setGenerationError] = useState('');
  const [loadingExchanges, setLoadingExchanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [syncConflict, setSyncConflict] = useState(false);
  const requestRef = useRef(0);
  const generationKickoffRef = useRef('');
  const generationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWriteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedErrorRef = useRef('');
  const hydratedRef = useRef(false);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [priorMeetingCounts, setPriorMeetingCounts] = useState<Record<string, number>>({});
  const [draftReady, setDraftReady] = useState(false);
  const [interactionPathStarted, setInteractionPathStarted] = useState(false);
  const [customFollowUpOpen, setCustomFollowUpOpen] = useState<boolean | null>(null);
  const [privateNotesOpen, setPrivateNotesOpen] = useState<boolean | null>(null);
  const [googleDriveReady, setGoogleDriveReady] = useState(false);
  const [oneDriveReady, setOneDriveReady] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const hasStartedInteraction = interactionPathStarted
    || (draftReady && draft.step === 0 && (
      draft.captureMode === 'quick_context'
      || draft.consent
      || draft.people.length > 0
      || Boolean(draft.recordingUri)
      || Boolean(draft.transcript.trim())
    ));
  const isCustomFollowUpOpen = customFollowUpOpen
    ?? (draft.step === 2 && (!commitmentSuggestions.length || Boolean(draft.followUp.trim())));
  const isPrivateNotesOpen = privateNotesOpen
    ?? (draft.step === 2 && Boolean(draft.privateNotes.trim()));

  const updateDraft = useCallback((changes: Partial<CaptureWizardDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...changes };
      const unchanged = (Object.keys(changes) as Array<keyof CaptureWizardDraft>).every(
        (key) => Object.is(current[key], next[key]),
      );
      return unchanged ? current : { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const getPriorMeetingCount = useCallback((email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return 0;
    return priorMeetingCounts[normalized] ?? 0;
  }, [priorMeetingCounts]);

  const reloadLatestRemoteCapture = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const current = draftRef.current;
      const sessions = await fetchCaptureSessions(session.access_token);
      const match = sessions.find((item) => item.encounterId === current.encounterId);
      if (!match) {
        setMessage('The latest capture could not be loaded. Your local recording remains safe on this device.');
        return;
      }
      const remote = captureDraftFromRemote(match);
      const merged: CaptureWizardDraft = {
        ...remote,
        recordingUri: current.recordingUri,
        recordingSource: current.recordingSource,
        importFileName: current.importFileName,
        importMimeType: current.importMimeType,
        hasLocalAudio: Boolean(current.recordingUri) || remote.hasLocalAudio,
      };
      suppressNextRemoteSyncRef.current = true;
      lastSyncedDraftAtRef.current = remote.updatedAt;
      setDraft(merged);
      setSyncConflict(false);
      setMessage('Loaded the latest capture. Audio stored on this device is still available.');
    } catch {
      setMessage('The latest capture could not be loaded. Check your connection and try again; your local recording remains safe.');
    }
  }, [session?.access_token]);

  function resolveContactIdForDraft(current: CaptureWizardDraft) {
    const email = current.personEmail.trim().toLowerCase();
    const exchangeId = current.exchangeId?.trim();
    const match = connections.find((connection) => (
      (email && connection.email?.trim().toLowerCase() === email)
      || (exchangeId && connection.source === 'inbound' && connection.sourceId === exchangeId)
    ));
    if (match?.source === 'contact') return match.sourceId;
    return current.contactId || '';
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

      const commitments = result.draft?.commitments ?? [];
      setCommitmentSuggestions(commitments);
      setSelectedCommitmentKeys(defaultCommitmentKeys(commitments));
      setCommitmentAssignments(initialCommitmentAssignments(commitments, hints.people));

      setDraft((current) => {
        const extracted = applyExtractionDraft(current, result.draft!, { replace: true });
        const hasManualFollowUp = Boolean(current.followUp.trim());
        const hasManualChannels = current.followUpChannels.length > 0;
        return {
          ...current,
          ...extracted,
          followUp: hasManualFollowUp
            ? current.followUp
            : commitments.length ? '' : extracted.followUp,
          followUpType: hasManualChannels ? current.followUpType : extracted.followUpType,
          followUpChannels: hasManualChannels
            ? current.followUpChannels
            : commitments.length
              ? []
              : result.draft?.followUp
                ? normalizeFollowUpChannels([result.draft.followUpType])
                : current.followUpChannels,
          dueAt: current.dueAt,
        };
      });
      setUncertainFields(result.uncertainFields ?? []);
      setGenerationStatus('idle');
      void notifyMeetingReviewReady({
        encounterId: hints.encounterId,
        title: result.draft?.title || hints.title,
      });
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

  const recorder = useSharedCaptureRecorder({
    transcript: draft.transcript,
    onTranscriptChange: handleTranscriptChange,
    onDurationChange: handleDurationChange,
    onRecordingUriChange: handleRecordingUriChange,
    onError: handleRecorderError,
    onImportReady: handleImportReady,
    onImportStarted: handleImportStarted,
    onTranscriptFinalized: handleTranscriptFinalized,
    transcribeFromServer,
  }, draft.encounterId);

  const recorderHydratedRef = useRef(false);
  const isTranscribing = recorder.transcriptStatus === 'transcribing'
    || recorder.serverTranscribePhase === 'preparing'
    || recorder.serverTranscribePhase === 'transcribing'
    || recorder.serverTranscribePhase === 'revealing'
    || recorder.isFinishing;

  useEffect(() => {
    if (!draftReady) return;

    const now = new Date().toISOString();
    if (recorder.recordingState === 'recording') {
      updateDraft({
        sessionStatus: 'recording',
        failureReason: '',
        recordingStartedAt: draftRef.current.recordingStartedAt || now,
        recordingStoppedAt: '',
      });
      return;
    }
    if (recorder.recordingState === 'paused') {
      updateDraft({ sessionStatus: 'paused' });
      return;
    }
    if (isTranscribing) {
      updateDraft({ sessionStatus: 'processing' });
      return;
    }
    if (recorder.recordingUri || draftRef.current.recordingUri) {
      updateDraft({
        sessionStatus: 'review_ready',
        recordingStoppedAt: draftRef.current.recordingStoppedAt || now,
      });
    }
  }, [draftReady, isTranscribing, recorder.recordingState, recorder.recordingUri, updateDraft]);

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
  const activeRecording = recorder.recordingState === 'recording'
    || recorder.recordingState === 'paused';

  const requestLeave = useCallback(() => {
    if (captureHasProgress) {
      const current = draftRef.current;
      const next = {
        ...current,
        recordingUri: current.recordingUri || recorder.recordingUri,
        recordingSource: current.recordingSource || recorder.recordingSource || current.recordingSource,
        transcript: current.transcript || recorder.displayTranscript.trim(),
        durationSeconds: current.durationSeconds || recorder.seconds,
      };
      setDraft(next);
      void writeCaptureDraft(next);
    }
    if (router.canGoBack()) router.back();
    else router.replace('/capture');
  }, [captureHasProgress, recorder]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        requestLeave();
        return true;
      });
      return () => subscription.remove();
    }, [requestLeave]),
  );

  useEffect(() => {
    if (!session?.access_token) return;
    void fetchConnectedAccounts(session.access_token)
      .then((status) => {
        setGoogleDriveReady(Boolean(status.google.connected && status.google.capabilities.drive));
        setOneDriveReady(Boolean(status.microsoft.connected && status.microsoft.capabilities.onedrive));
      })
      .catch(() => {
        setGoogleDriveReady(false);
        setOneDriveReady(false);
      });
  }, [session?.access_token]);

  useEffect(() => {
    if (!draftReady || draft.step < 1) return;
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
          ? await readCaptureDraftWithoutBlocking(String(params.draftId))
          : await readCaptureDraftWithoutBlocking();
        let remote: CaptureWizardDraft | null = null;
        if (!stored && params.draftId && session?.access_token) {
          const sessions = await fetchCaptureSessions(session.access_token).catch(() => []);
          const match = sessions.find((item) => item.encounterId === String(params.draftId));
          if (match) {
            remote = captureDraftFromRemote(match);
            lastSyncedDraftAtRef.current = remote.updatedAt;
          }
        }
        const next = { ...(stored ?? remote ?? createFreshCaptureDraft()) };
        if (params.exchange) next.exchangeId = String(params.exchange);
        if (!(next.people ?? []).length && params.personName?.trim()) {
          next.people = [createGatherPerson({
            id: params.sourceId ? String(params.sourceId) : undefined,
            name: String(params.personName).trim(),
            email: params.personEmail ? String(params.personEmail).trim() : '',
            exchangeId: params.exchange ? String(params.exchange) : undefined,
          })];
          Object.assign(next, syncLegacyPersonFields(next.people));
          next.contactId = params.contactId ? String(params.contactId) : next.contactId;
        }
        if (params.slug && readEnv()) {
          const name = await fetchPublicCardName(readEnv()!.publicCardBaseUrl, String(params.slug));
          if (name && !(next.people ?? []).length) {
            next.people = [createGatherPerson({ name })];
            Object.assign(next, syncLegacyPersonFields(next.people));
          }
        }
        setDraft(next);
        if (!stored) void writeCaptureDraft(next);
      } finally {
        setDraftReady(true);
      }
    })();
  }, [params.contactId, params.draftId, params.exchange, params.personEmail, params.personName, params.slug, params.sourceId, session?.access_token]);

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
    if (!draftReady || !session?.access_token || !hasCaptureDraftProgress(draft)) return;
    if (suppressNextRemoteSyncRef.current) {
      suppressNextRemoteSyncRef.current = false;
      return;
    }
    if (remoteSyncDebounceRef.current) clearTimeout(remoteSyncDebounceRef.current);
    remoteSyncDebounceRef.current = setTimeout(() => {
      void (async () => {
        const device = captureDeviceRef.current ?? await getCaptureDeviceIdentity();
        captureDeviceRef.current = device;
        const syncingDraft = draftRef.current;
        await syncCaptureSession(session.access_token, captureDraftToRemote(syncingDraft, device));
        lastSyncedDraftAtRef.current = syncingDraft.updatedAt;
        setSyncConflict(false);
      })().catch((syncError: unknown) => {
        if (syncError instanceof CaptureSessionConflictError) {
          setSyncConflict(true);
          setMessage('This capture moved forward on another device. Return to Capture and reopen it to load the latest version. Your local recording remains safe on this device.');
          return;
        }
        // Local draft remains authoritative while offline; the next edit retries sync.
      });
    }, 1200);
    return () => {
      if (remoteSyncDebounceRef.current) clearTimeout(remoteSyncDebounceRef.current);
    };
  }, [draft, draftReady, session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      if (!draftReady || !session?.access_token || !hasCaptureDraftProgress(draftRef.current)) return undefined;
      let cancelled = false;

      const refreshRemoteDraft = async () => {
        const current = draftRef.current;
        if (current.sessionStatus === 'recording' || current.sessionStatus === 'paused' || current.sessionStatus === 'processing') return;
        const device = captureDeviceRef.current ?? await getCaptureDeviceIdentity();
        captureDeviceRef.current = device;
        const sessions = await fetchCaptureSessions(session.access_token).catch(() => []);
        if (cancelled) return;
        const match = sessions.find((item) => item.encounterId === current.encounterId);
        if (!match || match.deviceId === device.id) return;
        if (Date.parse(match.updatedAt) <= Date.parse(current.updatedAt)) return;

        if (lastSyncedDraftAtRef.current && current.updatedAt !== lastSyncedDraftAtRef.current) {
          setMessage(`Newer changes are available from ${match.deviceLabel || 'another device'}. Finish or leave this field before reopening the draft to avoid replacing your local edits.`);
          return;
        }

        const remote = captureDraftFromRemote(match);
        const merged: CaptureWizardDraft = {
          ...remote,
          recordingUri: current.recordingUri,
          recordingSource: current.recordingSource,
          importFileName: current.importFileName,
          importMimeType: current.importMimeType,
          hasLocalAudio: Boolean(current.recordingUri) || remote.hasLocalAudio,
        };
        suppressNextRemoteSyncRef.current = true;
        lastSyncedDraftAtRef.current = remote.updatedAt;
        setDraft(merged);
        setSyncConflict(false);
        setMessage(match.sessionStatus === 'failed' && match.failureReason === 'recording_heartbeat_lost'
          ? `The recording on ${match.deviceLabel || 'another device'} was interrupted. Everything already captured is safe; review the draft here.`
          : `Updated with the latest context from ${match.deviceLabel || 'another device'}. Audio stays on the device that recorded it.`);
      };

      void refreshRemoteDraft();
      const timer = setInterval(() => { void refreshRemoteDraft(); }, 15000);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [draftReady, session?.access_token]),
  );

  useEffect(() => {
    if (!draftReady || recorderHydratedRef.current) return;
    recorderHydratedRef.current = true;

    void getCaptureDeviceIdentity().then((device) => { captureDeviceRef.current = device; });
    if (
      (draft.sessionStatus === 'recording' || draft.sessionStatus === 'paused')
      && recorder.recordingState !== 'recording'
      && recorder.recordingState !== 'paused'
      && !draft.recordingUri
      && (!draft.originDeviceId || draft.originDeviceId === captureDeviceRef.current?.id)
    ) {
      updateDraft({
        sessionStatus: 'failed',
        failureReason: 'recording_interrupted',
        recordingStoppedAt: new Date().toISOString(),
      });
      showCaptureError('The previous recording was interrupted before it could be saved. Your draft is safe; start a new recording to continue.');
    }

    if (draft.sessionStatus === 'failed' && draft.failureReason === 'recording_heartbeat_lost') {
      void Promise.resolve().then(() => {
        setMessage('The live recording was interrupted. Everything already captured is safe; review this draft and record again only if you need more audio.');
      });
    }

    if (draft.originDeviceId && draft.originDeviceId !== captureDeviceRef.current?.id && !draft.recordingUri) {
      showCaptureError(`The audio remains on ${draft.originDeviceLabel || 'the device that started this capture'}. You can continue the people, transcript, context, and follow-up here.`);
    }

    recorder.hydrateFromDraft({
      recordingUri: draft.recordingUri,
      recordingSource: draft.recordingSource,
      transcript: draft.transcript,
      durationSeconds: draft.durationSeconds,
    });

    if (draft.recordingUri && draft.transcript.trim().length < 20 && session?.access_token) {
      void recorder.transcribeRecordingIfNeeded(draft.recordingUri);
    }
  }, [draft.durationSeconds, draft.failureReason, draft.originDeviceId, draft.originDeviceLabel, draft.recordingSource, draft.recordingUri, draft.sessionStatus, draft.transcript, draftReady, recorder, session?.access_token, showCaptureError, updateDraft]);

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
      void Promise.resolve().then(() => {
        setConnections([]);
        setPriorMeetingCounts({});
      });
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
    if (draft.captureMode === 'recording' && !draft.consent) {
      showCaptureError('Confirm that everyone agreed before continuing.');
      return;
    }
    const people = draft.people ?? [];
    if (!hasValidGatherPeople(people)) {
      showCaptureError('Add at least one person you met.');
      return;
    }
    if (draft.captureMode === 'recording' && !skipRecording && (recorder.recordingState === 'recording' || recorder.recordingState === 'paused')) {
      await recorder.stopRecording();
    } else if (draft.captureMode !== 'recording') {
      await recorder.awaitPendingFinish();
    }
    updateDraft({ step: draft.captureMode === 'recording' ? 2 : 1 });
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
            retention: draft.recordingDestination === 'local_only' ? 'never' : draft.retention,
          });
        } catch (caught) {
          if (!recording) throw caught;
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
        followUp: draft.followUp,
        followUpChannels: draft.followUpChannels,
        commitments: commitmentSuggestions.flatMap((commitment, index) => {
          const key = commitmentKey(commitment, index);
          if (!selectedCommitmentKeys.includes(key)) return [];
          const assignment = commitmentAssignments[key] ?? { owner: commitment.owner, targetName: commitment.ownerName };
          return [{ ...commitment, owner: assignment.owner, ownerName: assignment.targetName }];
        }),
        dueAt: draft.dueAt,
        consentMethod: draft.consentMethod,
        consentConfirmed: draft.captureMode === 'recording' ? draft.consent : false,
        status: 'draft',
        durationSeconds: draft.durationSeconds || recorder.seconds,
        recording: recording ?? undefined,
      });
      await saveEncounter(token, payload);

      if (recording?.localUri && draft.recordingDestination === 'shared_3_days') {
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
          await updateLocalRecordingSharedUrl(draft.encounterId, uploaded.sharedAudioUrl ?? '', uploaded);
          await saveEncounter(token, { ...payload, recording });
        } catch (caught) {
          const shareError = caught instanceof Error
            ? caught.message
            : 'The three-day recording link could not be created. Your local copy is still safe.';
          showCaptureError(`${shareError} Retry when you are online.`);
          return;
        }
      }

      if (recording?.localUri && draft.recordingDestination === 'google_drive') {
        try {
          const driveRecording = await uploadEncounterRecordingToDrive(
            token,
            draft.encounterId,
            recording.localUri,
          );
          recording = {
            ...recording,
            ...driveRecording,
            localUri: recording.localUri,
            audioLocation: 'google_drive',
          };
          await saveEncounter(token, { ...payload, recording });
        } catch (caught) {
          const driveError = caught instanceof Error
            ? caught.message
            : 'Google Drive could not save this recording. Your local copy is still safe.';
          showCaptureError(`${driveError} Open Connected accounts to reconnect Google, then retry from this draft.`);
          return;
        }
      }

      if (recording?.localUri && draft.recordingDestination === 'onedrive') {
        try {
          const oneDriveRecording = await uploadEncounterRecordingToOneDrive(
            token,
            draft.encounterId,
            recording.localUri,
          );
          recording = {
            ...recording,
            ...oneDriveRecording,
            localUri: recording.localUri,
            audioLocation: 'onedrive',
          };
          await saveEncounter(token, { ...payload, recording });
        } catch (caught) {
          const oneDriveError = caught instanceof Error
            ? caught.message
            : 'OneDrive could not save this recording. Your local copy is still safe.';
          showCaptureError(`${oneDriveError} Open Connected accounts to reconnect Microsoft, then retry from this draft.`);
          return;
        }
      }
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
          <PageHeader
            eyebrow={draft.step === 0
              ? draft.captureMode === 'recording'
                ? 'Get consent, then record'
                : 'Write what mattered'
              : 'Meeting context'}
            title={draft.step === 0
              ? draft.captureMode === 'recording'
                ? 'Record this conversation'
                : 'Add notes'
              : 'What mattered in this meeting?'}
            titleStyle={styles.title}
            onBack={requestLeave}
            rightAction={draft.step === 0 && !activeRecording ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={draft.captureMode === 'recording' ? 'Use notes instead' : 'Record instead'}
                onPress={() => {
                  updateDraft({
                    captureMode: draft.captureMode === 'recording' ? 'quick_context' : 'recording',
                  });
                  setInteractionPathStarted(true);
                }}
                style={styles.headerModeAction}
                hitSlop={8}>
                <Text style={styles.headerModeActionText}>
                  {draft.captureMode === 'recording' ? 'Use notes' : 'Record'}
                </Text>
              </Pressable>
            ) : undefined}
          />
        </View>

        {!activeRecording && draft.step > 0 ? <View style={styles.stepperWrap}>
          <CaptureStepIndicator current={draft.step} onStep={goToStep} />
        </View> : null}

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
              onPathStateChange={setInteractionPathStarted}
              openConsentOnMount={params.openConsent === '1'}
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
              {isTranscribing || generationStatus === 'generating' ? (
                <View style={styles.backgroundStatus}>
                  <ActivityIndicator size="small" color={colors.ink} />
                  <View style={styles.backgroundStatusCopy}>
                    <Text style={styles.backgroundStatusTitle}>Preparing the meeting review</Text>
                    <Text style={styles.backgroundStatusBody}>
                      Set the follow-up, channel, and reminder now. We’ll notify you when the transcript is ready.
                    </Text>
                  </View>
                </View>
              ) : null}
              {commitmentSuggestions.length ? (
                <View style={styles.commitmentPanel}>
                  <Text style={styles.commitmentTitle}>Suggested from the conversation</Text>
                  <Text style={styles.fieldHint}>Every included promise becomes its own follow-up. Remove any suggestion that is wrong.</Text>
                  {commitmentSuggestions.map((commitment, sourceIndex) => ({ commitment, sourceIndex })).map(({ commitment, sourceIndex }) => {
                    const key = commitmentKey(commitment, sourceIndex);
                    const selected = selectedCommitmentKeys.includes(key);
                    const assignment = commitmentAssignments[key] ?? { owner: commitment.owner, targetName: commitment.ownerName };
                    return <View key={key} style={[styles.commitmentOption, selected && styles.commitmentOptionSelected]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedCommitmentKeys((current) => (
                          current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
                        ))}
                        style={styles.commitmentToggle}>
                        <View style={styles.commitmentCopy}>
                          <Text style={styles.commitmentOptionTitle}>{commitment.title}</Text>
                          <Text style={styles.commitmentMeta}>
                            {commitment.channel}{commitment.dueAt ? ` · due ${commitment.dueAt}` : ' · no due date agreed'}
                          </Text>
                        </View>
                        <Text style={styles.commitmentUse}>{selected ? 'Included' : 'Add'}</Text>
                      </Pressable>
                      {selected ? <View style={styles.commitmentAssignment}>
                        <Text style={styles.commitmentAssignmentLabel}>Owner</Text>
                        <View style={styles.commitmentAssignmentRow}>
                          <Pressable onPress={() => setCommitmentAssignments((current) => ({
                            ...current,
                            [key]: { owner: 'me', targetName: current[key]?.targetName || draft.people[0]?.name || '' },
                          }))} style={[styles.assignmentChip, assignment.owner === 'me' && styles.assignmentChipSelected]}>
                            <Text style={styles.assignmentChipText}>You</Text>
                          </Pressable>
                          {draft.people.map((person) => <Pressable key={person.id} onPress={() => setCommitmentAssignments((current) => ({
                            ...current,
                            [key]: { owner: 'guest', targetName: person.name },
                          }))} style={[styles.assignmentChip, assignment.owner === 'guest' && assignment.targetName === person.name && styles.assignmentChipSelected]}>
                            <Text style={styles.assignmentChipText}>{person.name || 'Guest'}</Text>
                          </Pressable>)}
                        </View>
                        {assignment.owner === 'me' && draft.people.length > 1 ? <>
                          <Text style={styles.commitmentAssignmentLabel}>Track with</Text>
                          <View style={styles.commitmentAssignmentRow}>
                            {draft.people.map((person) => <Pressable key={person.id} onPress={() => setCommitmentAssignments((current) => ({
                              ...current,
                              [key]: { ...assignment, targetName: person.name },
                            }))} style={[styles.assignmentChip, assignment.targetName === person.name && styles.assignmentChipSelected]}>
                              <Text style={styles.assignmentChipText}>{person.name || 'Guest'}</Text>
                            </Pressable>)}
                          </View>
                        </> : null}
                      </View> : null}
                    </View>;
                  })}
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isCustomFollowUpOpen }}
                onPress={() => setCustomFollowUpOpen(!isCustomFollowUpOpen)}
                style={styles.optionalSectionToggle}>
                <View style={styles.optionalSectionCopy}>
                  <Text style={styles.optionalSectionTitle}>
                    {selectedCommitmentKeys.length ? 'Add another follow-up' : 'Create a follow-up'}
                  </Text>
                  <Text style={styles.optionalSectionHint}>
                    {draft.followUp.trim() || 'Add something the conversation did not identify.'}
                  </Text>
                </View>
                <Text style={styles.optionalSectionAction}>{isCustomFollowUpOpen ? 'Hide' : 'Add'}</Text>
              </Pressable>

              {isCustomFollowUpOpen ? <View style={styles.optionalSectionBody}>
                <Text style={styles.label}>Start with a template</Text>
                <View style={styles.templateRow}>
                  {FOLLOW_UP_TEMPLATES.map((template) => (
                    <Pressable
                      key={template.id}
                      accessibilityRole="button"
                      onPress={() => updateDraft({
                        followUp: template.buildTitle(formatPeopleNames(draft.people) || draft.personName),
                        followUpChannels: [template.channel],
                        followUpType: template.channel,
                        dueAt: template.dueAt(),
                      })}
                      style={styles.templateChip}>
                      <Text style={styles.templateChipText}>{template.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Follow-up</Text>
                <TextInput
                  value={draft.followUp}
                  onChangeText={(value) => updateDraft({ followUp: value })}
                  placeholder="Send the proposal on Friday"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                {(draft.people ?? []).length > 1 ? (
                  <View style={styles.followUpPeopleWrap}>
                    <Text style={styles.label}>Track with</Text>
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
                <Text style={styles.label}>Channel</Text>
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
              </View> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isPrivateNotesOpen }}
                onPress={() => setPrivateNotesOpen(!isPrivateNotesOpen)}
                style={styles.optionalSectionToggle}>
                <View style={styles.optionalSectionCopy}>
                  <Text style={styles.optionalSectionTitle}>Private notes</Text>
                  <Text style={styles.optionalSectionHint}>
                    {draft.privateNotes.trim() ? 'Saved for you only.' : 'Optional and never shared.'}
                  </Text>
                </View>
                <Text style={styles.optionalSectionAction}>{isPrivateNotesOpen ? 'Hide' : 'Add'}</Text>
              </Pressable>
              {isPrivateNotesOpen ? <TextInput
                value={draft.privateNotes}
                onChangeText={(value) => updateDraft({ privateNotes: value })}
                multiline
                scrollEnabled
                placeholder="Anything you want to remember for yourself…"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textarea]}
              /> : null}

              {draft.captureMode === 'recording' && (draft.recordingUri || recorder.recordingUri) ? (
                <View style={styles.recordingAccessSection}>
                  <View style={styles.recordingAccessHead}>
                    <Text style={styles.recordingAccessTitle}>Recording access</Text>
                    <Text style={styles.recordingAccessHint}>
                      Choose where the finished audio lives. You can change this before saving.
                    </Text>
                  </View>
                  <View style={styles.recordingAccessList}>
                    {([
                      { id: 'local_only', label: 'Only on this device', detail: 'Private local copy', icon: DeviceMobile, ready: true },
                      { id: 'shared_3_days', label: 'Share online for 3 days', detail: 'Participants can listen or download', icon: CloudArrowUp, ready: true },
                      { id: 'google_drive', label: 'Keep in Google Drive', detail: googleDriveReady ? 'Uses your connected Google account' : 'Reconnect Google to enable Drive', icon: CloudArrowUp, ready: googleDriveReady },
                      { id: 'onedrive', label: 'Keep in OneDrive', detail: oneDriveReady ? 'Uses your connected Microsoft account' : 'Reconnect Microsoft to enable OneDrive', icon: CloudArrowUp, ready: oneDriveReady },
                    ] as const).map((destination) => {
                      const selected = draft.recordingDestination === destination.id;
                      const Icon = destination.icon;
                      return (
                        <Pressable
                          key={destination.id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected, disabled: !destination.ready }}
                          onPress={() => {
                            if (!destination.ready) {
                              router.push('/settings/connected-accounts');
                              return;
                            }
                            updateDraft({ recordingDestination: destination.id });
                          }}
                          style={[
                            styles.recordingAccessOption,
                            selected && styles.recordingAccessOptionActive,
                            !destination.ready && styles.recordingAccessOptionDisabled,
                          ]}>
                          <Icon size={18} color={colors.ink} weight="bold" />
                          <View style={styles.recordingAccessCopy}>
                            <Text style={styles.recordingAccessLabel}>{destination.label}</Text>
                            <Text style={styles.recordingAccessDetail}>{destination.detail}</Text>
                          </View>
                          <View style={[styles.recordingAccessRadio, selected && styles.recordingAccessRadioActive]} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {message ? (
            <View style={styles.syncMessage}>
              <Text style={syncConflict ? styles.error : styles.success}>{message}</Text>
              {syncConflict ? (
                <Button variant="secondary" onPress={() => void reloadLatestRemoteCapture()}>
                  Load latest capture
                </Button>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {!activeRecording ? <View style={styles.footer}>
          {draft.step > 0 ? (
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => goToStep(draft.step - 1)}>
              Back
            </Button>
          ) : null}
          {draft.step === 0 && hasStartedInteraction ? (
            <>
              <Button
                style={{ flex: 1 }}
                onPress={() => void continueFromInteraction(false)}
                disabled={
                  (draft.captureMode === 'recording' && !draft.consent)
                  || !hasValidGatherPeople(draft.people ?? [])
                }>
                {draft.captureMode === 'quick_context' ? 'Add context' : 'Set follow-up'}
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
        </View> : null}
      </View>
      )}
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
  headerModeAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.x2,
  },
  headerModeActionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
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
  backgroundStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
  },
  backgroundStatusCopy: { flex: 1, gap: spacing.x1 },
  backgroundStatusTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  backgroundStatusBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
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
  recordingAccessSection: {
    gap: spacing.x3,
    paddingTop: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  recordingAccessHead: { gap: spacing.x1 },
  recordingAccessTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  recordingAccessHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  recordingAccessList: { gap: spacing.x2 },
  recordingAccessOption: {
    minHeight: 68,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
  },
  recordingAccessOptionActive: { borderColor: colors.ink, backgroundColor: colors.surfaceMuted },
  recordingAccessOptionDisabled: { opacity: 0.62 },
  recordingAccessCopy: { flex: 1, minWidth: 0 },
  recordingAccessLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  recordingAccessDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  recordingAccessRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  recordingAccessRadioActive: { borderColor: colors.ink, backgroundColor: colors.accent },
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
  optionalSectionToggle: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  optionalSectionCopy: { flex: 1, gap: 3 },
  optionalSectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  optionalSectionHint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  optionalSectionAction: { color: colors.ink, fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' },
  optionalSectionBody: {
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
  },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  commitmentPanel: {
    gap: spacing.x2,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
  },
  commitmentTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  commitmentOption: {
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  commitmentOptionSelected: {
    borderColor: colors.ink,
    backgroundColor: '#E3F6D7',
  },
  commitmentToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3, padding: spacing.x3 },
  commitmentAssignment: { gap: spacing.x2, paddingHorizontal: spacing.x3, paddingBottom: spacing.x3 },
  commitmentAssignmentLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  commitmentAssignmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  assignmentChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.round, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  assignmentChipSelected: { borderColor: colors.ink, backgroundColor: colors.accent },
  assignmentChipText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  commitmentCopy: { flex: 1, gap: 3 },
  commitmentOptionTitle: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  commitmentMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, textTransform: 'capitalize' },
  commitmentUse: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  templateChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.round,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  templateChipText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
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
  syncMessage: { gap: spacing.x2, alignItems: 'flex-start' },
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
