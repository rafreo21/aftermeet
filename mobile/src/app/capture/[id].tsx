import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, CloudArrowUp, EnvelopeSimple, ShareNetwork } from 'phosphor-react-native';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { CollapsibleTranscriptSection } from '@/components/collapsible-transcript-section';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { OutcomeSuccessSheet } from '@/components/outcome-success-sheet';
import { RecordingPlayback } from '@/components/recording-playback';
import { ConnectionDetailSkeleton } from '@/components/skeleton';
import { Body, Button, PageHeader, Panel, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  resolveEncounterRecordingUri,
  updateLocalRecordingSharedUrl,
} from '@/features/encounters/local-recordings';
import {
  getEncounter,
  saveEncounter,
  uploadEncounterRecording,
  type EncounterPayload,
} from '@/features/encounters/encounter-api';
import {
  followUpChannelsFromEncounter,
  followUpDueFromEncounter,
  FOLLOW_UP_CHANNELS,
} from '@/features/follow-ups/follow-up-channels';
import { formatDueLabel } from '@/lib/due-date';
import { openEmailCompose } from '@/lib/email-compose';
import { readEnv } from '@/lib/env';
import { buildRecordingShareEmail, formatMeetingEmailDate } from '@/lib/recording-email';
import {
  CLOUD_RECORDING_RETENTION_DAYS,
  formatCloudAvailableUntil,
  isCloudRecordingExpired,
} from '@/lib/recording-metadata';
import { colors, radius, spacing } from '@/theme/tokens';

type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed' | 'none';

export default function CaptureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [encounter, setEncounter] = useState<EncounterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState('');
  const [approveHint, setApproveHint] = useState('');
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successSheetOpen, setSuccessSheetOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(true);

  const followUpSummary = useMemo(() => {
    if (!encounter) return null;
    const channels = followUpChannelsFromEncounter(encounter.actions);
    const dueAt = followUpDueFromEncounter(encounter.actions);
    const channelLabels = channels.map(
      (channel) => FOLLOW_UP_CHANNELS.find((entry) => entry.id === channel)?.label || channel,
    );
    return {
      notes: encounter.privateNotes.trim(),
      channelLabels,
      dueLabel: formatDueLabel(dueAt),
    };
  }, [encounter]);

  const guestUrl = encounter && readEnv()
    ? `${readEnv()!.publicCardBaseUrl}/e/${encounter.shareToken}`
    : '';

  const isShared = encounter?.status === 'shared';
  const cloudReady = Boolean(
    uploadStatus === 'uploaded'
    || encounter?.recording?.sharedAudioUrl
    || encounter?.recording?.storagePath,
  );
  const cloudAvailableUntil = formatCloudAvailableUntil(encounter?.recording?.cloudExpiresAt);
  const cloudExpired = isCloudRecordingExpired(encounter?.recording?.cloudExpiresAt);

  async function syncUpload(
    accessToken: string,
    encounterId: string,
    localUri: string,
    mimeType?: string,
  ) {
    setUploadStatus('uploading');
    setUploadError('');
    try {
      const uploaded = await uploadEncounterRecording(accessToken, encounterId, localUri, mimeType);
      await updateLocalRecordingSharedUrl(encounterId, uploaded.sharedAudioUrl ?? '');
      setEncounter((current) => current ? {
        ...current,
        recording: {
          ...(current.recording ?? {
            id: current.id,
            durationSeconds: current.durationSeconds,
            fileSize: 0,
            mimeType: mimeType || 'audio/mp4',
            source: 'recorded',
            retention: '7_days',
            expiresAt: null,
            createdAt: current.startedAt,
            localUri,
          }),
          ...uploaded,
          localUri,
          audioLocation: 'server',
        },
      } : current);
      setUploadStatus('uploaded');
      return uploaded;
    } catch (caught) {
      setUploadStatus('failed');
      setUploadError(caught instanceof Error ? caught.message : 'Could not upload recording for guests.');
      return null;
    }
  }

  useEffect(() => {
    if (!session?.access_token || !id) {
      setLoading(false);
      setRecordingLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const nextEncounter = await getEncounter(session.access_token!, id);
        if (cancelled) return;
        setEncounter(nextEncounter);

        const uri = await resolveEncounterRecordingUri(id, nextEncounter.recording);
        if (cancelled) return;
        setRecordingUri(uri);
        setRecordingLoading(false);

        if (nextEncounter.recording?.sharedAudioUrl || nextEncounter.recording?.storagePath) {
          setUploadStatus('uploaded');
        } else if (uri?.startsWith('file')) {
          void syncUpload(session.access_token!, nextEncounter.id, uri, nextEncounter.recording?.mimeType);
        } else if (nextEncounter.durationSeconds > 0 || nextEncounter.recording) {
          setUploadStatus('none');
        } else {
          setUploadStatus('none');
        }
      } catch (caught) {
        if (cancelled) return;
        setErrorMessage(caught instanceof Error ? caught.message : 'Could not load this meeting.');
        setErrorSheetOpen(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRecordingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, session?.access_token]);

  const recordingDuration = useMemo(
    () => encounter?.durationSeconds || encounter?.recording?.durationSeconds || 0,
    [encounter?.durationSeconds, encounter?.recording?.durationSeconds],
  );

  const hasRecording = Boolean(
    recordingUri
    || encounter?.recording
    || encounter?.durationSeconds
    || encounter?.transcript.trim(),
  );

  async function persist(next: EncounterPayload) {
    if (!session?.access_token) return;
    setSaving(true);
    setApproveHint('');
    try {
      await saveEncounter(session.access_token, next);
      setEncounter(next);
      setSuccessMessage('Changes saved.');
      setSuccessSheetOpen(true);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Could not save changes.');
      setErrorSheetOpen(true);
    } finally {
      setSaving(false);
    }
  }

  async function approveAndShare() {
    if (!encounter || !session?.access_token) return;
    setApproveHint('');

    if (!encounter.sharedSummary.trim()) {
      setApproveHint('Add a short share summary below, then approve.');
      return;
    }

    if (uploadStatus === 'uploading') {
      setApproveHint('Recording is still uploading. Try again in a moment.');
      return;
    }

    if (uploadStatus === 'failed' && recordingUri) {
      setApproveHint('Upload the recording first, then approve.');
      setApproving(true);
      const uploaded = await syncUpload(
        session.access_token,
        encounter.id,
        recordingUri,
        encounter.recording?.mimeType,
      );
      setApproving(false);
      if (!uploaded) return;
    } else if (
      recordingUri?.startsWith('file')
      && !cloudReady
      && uploadStatus !== 'none'
    ) {
      setApproving(true);
      const uploaded = await syncUpload(
        session.access_token,
        encounter.id,
        recordingUri,
        encounter.recording?.mimeType,
      );
      setApproving(false);
      if (!uploaded) {
        setApproveHint('Could not upload the recording. You can still approve the written summary, or retry upload.');
        return;
      }
    }

    const next = { ...encounter, status: 'shared' as const };
    setApproving(true);
    try {
      await saveEncounter(session.access_token, next);
      setEncounter(next);
      setApproveHint('');
      setSuccessMessage('Guest view approved.');
      setSuccessSheetOpen(true);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Could not approve the guest view.');
      setErrorSheetOpen(true);
    } finally {
      setApproving(false);
    }
  }

  async function shareGuestLink() {
    if (!guestUrl || !encounter || !isShared) return;
    await Share.share({
      title: `${encounter.personName || encounter.title} · AfterMeet`,
      message: guestUrl,
      url: guestUrl,
    });
  }

  async function emailRecordingWithDetails() {
    if (!encounter || !guestUrl) return;
    const email = buildRecordingShareEmail({
      title: encounter.title,
      personName: encounter.personName,
      personEmail: encounter.personEmail,
      guestUrl,
      sharedSummary: encounter.sharedSummary,
      meetingDate: formatMeetingEmailDate(encounter.startedAt),
      cloudExpired: isCloudRecordingExpired(encounter.recording?.cloudExpiresAt),
    });
    await openEmailCompose(email);
  }

  async function shareRecordingFile() {
    if (!recordingUri || !encounter) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(recordingUri, {
        mimeType: encounter.recording?.mimeType || 'audio/mp4',
        dialogTitle: 'Send meeting recording',
      });
      return;
    }
    await Share.share({
      title: `${encounter.title} recording`,
      message: encounter.sharedSummary || encounter.title,
      url: recordingUri,
    });
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']} reserveTabBar={false}>
        <PageHeader eyebrow="Previous capture" title="Loading capture" titleStyle={styles.title} />
        <ConnectionDetailSkeleton />
      </Screen>
    );
  }

  if (!session || !encounter) {
    return (
      <Screen edges={['top', 'bottom']} reserveTabBar={false}>
        <PageHeader eyebrow="Previous" title="Meeting not available" titleStyle={styles.title} />
        <Body>{errorMessage || 'Sign in to view this meeting.'}</Body>
        {!session ? <Button onPress={() => router.push('/auth')}>Sign in</Button> : null}
        <Button variant="secondary" onPress={() => router.back()}>Go back</Button>
        <OutcomeErrorSheet
          visible={errorSheetOpen}
          message={errorMessage}
          onClose={() => {
            setErrorSheetOpen(false);
            setErrorMessage('');
          }}
        />
      </Screen>
    );
  }

  const showEmailRecording = Boolean(
    recordingUri
    && (cloudExpired || uploadStatus === 'failed' || !encounter.recording?.sharedAudioUrl),
  );

  return (
    <Screen edges={['top', 'bottom']} reserveTabBar={false}>
      <PageHeader
        eyebrow="Previous capture"
        title={encounter.personName || encounter.title}
        titleStyle={styles.title}
      />
      <Body>Review the summary, save your edits, and approve the guest view when you are ready.</Body>

      {hasRecording ? (
        <View style={styles.recorderCard}>
          {recordingLoading ? (
            <View style={styles.recordingLoading}>
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.recordingMissing}>Loading recording…</Text>
            </View>
          ) : recordingUri ? (
            <RecordingPlayback uri={recordingUri} durationSeconds={recordingDuration} variant="compact" />
          ) : (
            <Text style={styles.recordingMissing}>
              This recording was saved, but the audio file is missing from this device. Re-open the capture from the same phone if you just recorded it.
            </Text>
          )}

          {encounter.transcript ? (
            <CollapsibleTranscriptSection
              title="Full transcript"
              hint="Expand to edit the full transcript"
              value={encounter.transcript}
              onChangeText={(value) => setEncounter({ ...encounter, transcript: value })}
              defaultOpen={false}
            />
          ) : null}
        </View>
      ) : null}

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Share summary</Text>
        <Text style={styles.label}>Meeting recap</Text>
        <TextInput
          value={encounter.sharedSummary}
          onChangeText={(value) => {
            setApproveHint('');
            setEncounter({ ...encounter, sharedSummary: value });
          }}
          multiline
          scrollEnabled
          placeholder="What you discussed, decided, and who owns what next…"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.notesField]}
        />
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Guest sharing</Text>
        <View style={styles.statusRow}>
          {isShared ? <CheckCircle size={18} color={colors.accent} weight="fill" /> : null}
          <Text style={styles.summaryCopy}>
            {isShared
              ? 'Approved. Guests can open the shared summary and recording.'
              : 'Still a draft. Approve when the summary looks right.'}
          </Text>
        </View>
        {cloudReady && cloudAvailableUntil && !cloudExpired ? (
          <Text style={styles.helperCopy}>
            Cloud recording available until {cloudAvailableUntil} ({CLOUD_RECORDING_RETENTION_DAYS} days).
          </Text>
        ) : null}
        {cloudExpired ? (
          <Text style={styles.helperCopy}>
            The cloud recording expired. Guests still see the shared summary. You can play it locally on this phone.
          </Text>
        ) : null}
        {uploadStatus === 'uploading' ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.ink} size="small" />
            <Text style={styles.helperCopy}>Uploading recording for guest sharing…</Text>
          </View>
        ) : null}
        {uploadStatus === 'failed' ? (
          <View style={styles.uploadFailed}>
            <Text style={styles.uploadFailedText}>{uploadError || 'Upload failed.'}</Text>
            {recordingUri ? (
              <Button
                variant="secondary"
                onPress={() => void syncUpload(
                  session.access_token!,
                  encounter.id,
                  recordingUri,
                  encounter.recording?.mimeType,
                )}>
                <CloudArrowUp size={18} color={colors.ink} />
                Retry upload
              </Button>
            ) : null}
          </View>
        ) : null}
        {approveHint ? <Text style={styles.approveHint}>{approveHint}</Text> : null}
        {!isShared ? (
          <Button loading={approving || uploadStatus === 'uploading'} onPress={() => void approveAndShare()}>
            Approve guest view
          </Button>
        ) : guestUrl ? (
          <Button variant="secondary" onPress={() => void shareGuestLink()}>
            <ShareNetwork size={18} color={colors.ink} />
            Share guest link
          </Button>
        ) : null}
        {showEmailRecording ? (
          <>
            <Button variant="secondary" onPress={() => void emailRecordingWithDetails()}>
              <EnvelopeSimple size={18} color={colors.ink} />
              Email recording + details
            </Button>
            <Button variant="secondary" onPress={() => void shareRecordingFile()}>
              <ShareNetwork size={18} color={colors.ink} />
              Send recording file
            </Button>
          </>
        ) : null}
      </Panel>

      {followUpSummary ? (
        <Panel style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-up plan</Text>
          <Text style={styles.label}>Private notes</Text>
          <Text style={styles.summaryCopy}>
            {followUpSummary.notes || 'No private notes added.'}
          </Text>
          <Text style={styles.label}>Channels</Text>
          <Text style={styles.summaryCopy}>
            {followUpSummary.channelLabels.length
              ? followUpSummary.channelLabels.join(' · ')
              : 'No follow-up channels selected.'}
          </Text>
          {followUpSummary.dueLabel ? (
            <>
              <Text style={styles.label}>Due</Text>
              <Text style={styles.summaryCopy}>{followUpSummary.dueLabel}</Text>
            </>
          ) : null}
        </Panel>
      ) : null}

      <View style={styles.actions}>
        <Button loading={saving} onPress={() => void persist(encounter)}>Save changes</Button>
        <Button variant="ghost" onPress={() => router.replace('/capture')}>Done</Button>
      </View>

      <OutcomeErrorSheet
        visible={errorSheetOpen}
        message={errorMessage}
        onClose={() => {
          setErrorSheetOpen(false);
          setErrorMessage('');
        }}
      />

      <OutcomeSuccessSheet
        visible={successSheetOpen}
        message={successMessage}
        onClose={() => {
          setSuccessSheetOpen(false);
          setSuccessMessage('');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 32 },
  recorderCard: {
    gap: spacing.x5,
    padding: spacing.x6,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  recordingLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
  },
  recordingMissing: { color: colors.muted, fontSize: 13, lineHeight: 20, flex: 1 },
  section: { gap: spacing.x3 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  helperCopy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  approveHint: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  uploadFailed: { gap: spacing.x2 },
  uploadFailedText: { color: colors.danger, fontSize: 13, lineHeight: 20 },
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
  notesField: { height: 140, maxHeight: 140, paddingTop: spacing.x3, textAlignVertical: 'top' },
  summaryCopy: { color: colors.ink, fontSize: 15, lineHeight: 22, flex: 1 },
  actions: { gap: spacing.x2 },
});
