import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, CloudArrowUp, EnvelopeSimple, Plus, ShareNetwork, Trash } from 'phosphor-react-native';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CollapsibleTranscriptSection } from '@/components/collapsible-transcript-section';
import { FollowUpDuePicker } from '@/components/follow-up-due-picker';
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
  FOLLOW_UP_CHANNELS,
  type FollowUpChannel,
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
  const [guestSharingEnabled, setGuestSharingEnabled] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [approveHint, setApproveHint] = useState('');
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successSheetOpen, setSuccessSheetOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(true);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionChannel, setNewActionChannel] = useState<FollowUpChannel>('email');
  const [newActionDueAt, setNewActionDueAt] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('me');

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
      const uploaded = await uploadEncounterRecording(accessToken, encounterId, localUri);
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
        setGuestSharingEnabled(nextEncounter.status === 'shared');

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

  const expectsAudio = Boolean(
    recordingUri
    || encounter?.recording?.storagePath
    || encounter?.recording?.sharedAudioUrl
    || encounter?.recording?.localUri
    || (encounter?.durationSeconds ?? 0) > 0
    || Boolean(encounter?.recording),
  );
  const hasTranscript = Boolean(encounter?.transcript.trim());

  const needsUpload = Boolean(
    recordingUri?.startsWith('file')
    && !cloudReady
    && uploadStatus !== 'uploaded',
  );
  const canApprove = guestSharingEnabled && uploadStatus !== 'uploading' && !needsUpload;

  function toggleGuestSharing(next: boolean) {
    setGuestSharingEnabled(next);
    setApproveHint('');

    if (next) {
      if (needsUpload && recordingUri && session?.access_token && encounter) {
        void syncUpload(session.access_token, encounter.id, recordingUri, encounter.recording?.mimeType);
      }
      return;
    }

    if (isShared && encounter && session?.access_token) {
      const reverted = { ...encounter, status: 'reviewed' as const };
      setApproving(true);
      saveEncounter(session.access_token, reverted)
        .then(() => setEncounter(reverted))
        .catch((caught) => {
          setErrorMessage(caught instanceof Error ? caught.message : 'Could not turn off guest sharing.');
          setErrorSheetOpen(true);
          setGuestSharingEnabled(true);
        })
        .finally(() => setApproving(false));
    }
  }

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

  function addAction() {
    if (!encounter || !newActionTitle.trim()) return;
    const participant = encounter.participants.find((person) => person.id === newActionOwner);
    setEncounter({
      ...encounter,
      actions: [...encounter.actions, {
        id: `action-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: newActionTitle.trim(),
        channel: newActionChannel,
        owner: participant ? 'guest' : 'me',
        dueAt: newActionDueAt,
        status: 'open',
        participantId: participant?.id,
        assigneeName: participant?.name,
        assigneeEmail: participant?.email,
      }],
    });
    setNewActionTitle('');
    setNewActionDueAt('');
  }

  function toggleAction(actionId: string) {
    if (!encounter) return;
    setEncounter({
      ...encounter,
      actions: encounter.actions.map((action) => action.id === actionId
        ? { ...action, status: action.status === 'completed' ? 'open' : 'completed' }
        : action),
    });
  }

  function removeAction(actionId: string) {
    if (!encounter) return;
    setEncounter({ ...encounter, actions: encounter.actions.filter((action) => action.id !== actionId) });
  }

  async function approveAndShare() {
    if (!encounter || !session?.access_token) return;
    setApproveHint('');

    if (!encounter.sharedSummary.trim()) {
      setApproveHint('Add a short share summary below, then approve.');
      return;
    }

    if (!guestSharingEnabled) {
      setApproveHint('Turn on guest sharing above, then approve.');
      return;
    }

    if (uploadStatus === 'uploading' || needsUpload) {
      setApproveHint('Recording is still uploading. Approve unlocks once it finishes.');
      return;
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
      <Body>Review the summary, save your edits, and share with guests from the follow-up plan when ready.</Body>

      {expectsAudio || hasTranscript ? (
        <View style={styles.recorderCard}>
          {expectsAudio ? (
            recordingLoading ? (
              <View style={styles.recordingLoading}>
                <ActivityIndicator color={colors.ink} />
                <Text style={styles.recordingMissing}>Loading recording…</Text>
              </View>
            ) : recordingUri ? (
              <RecordingPlayback uri={recordingUri} durationSeconds={recordingDuration} variant="compact" />
            ) : (
              <Text style={styles.recordingMissing}>
                Audio is not on this device yet. If you just recorded here, try Record again — a saved file is required for playback and guest sharing.
              </Text>
            )
          ) : null}

          {hasTranscript ? (
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
        <Text style={styles.sectionTitle}>Follow-up plan</Text>
        {encounter.participants.length ? (
          <View style={styles.peopleWrap}>
            <Text style={styles.label}>People in this meeting</Text>
            <View style={styles.peopleRow}>
              {encounter.participants.map((person) => (
                <View key={person.id} style={styles.personChip}>
                  <Text style={styles.personChipText}>{person.name || 'Guest'}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <Text style={styles.label}>Private notes</Text>
        <TextInput
          value={encounter.privateNotes}
          onChangeText={(value) => setEncounter({ ...encounter, privateNotes: value })}
          multiline
          scrollEnabled
          placeholder="Anything only you need to remember…"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.privateNotesField]}
        />
        <Text style={styles.label}>Next actions</Text>
        {encounter.actions.length ? (
          <View style={styles.actionList}>
            {encounter.actions.map((action) => {
              const participant = encounter.participants.find((person) => person.id === action.participantId);
              const channelLabel = FOLLOW_UP_CHANNELS.find((channel) => channel.id === action.channel)?.label || action.channel;
              return (
                <View key={action.id} style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: action.status === 'completed' }}
                    accessibilityLabel={`${action.status === 'completed' ? 'Reopen' : 'Complete'} ${action.title}`}
                    onPress={() => toggleAction(action.id)}>
                    <CheckCircle size={22} color={action.status === 'completed' ? colors.accent : colors.muted} weight={action.status === 'completed' ? 'fill' : 'regular'} />
                  </Pressable>
                  <View style={styles.actionCopy}>
                    <Text style={[styles.actionTitle, action.status === 'completed' && styles.actionTitleDone]}>{action.title}</Text>
                    <Text style={styles.helperCopy}>{action.owner === 'me' ? 'You' : participant?.name || action.assigneeName || 'Guest'} · {channelLabel}{action.dueAt ? ` · ${formatDueLabel(action.dueAt)}` : ''}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${action.title}`} onPress={() => removeAction(action.id)} hitSlop={8}>
                    <Trash size={19} color={colors.muted} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : <Text style={styles.helperCopy}>No next actions yet.</Text>}
        <View style={styles.actionComposer}>
          <TextInput
            value={newActionTitle}
            onChangeText={setNewActionTitle}
            placeholder="e.g. Send the product draft"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.label}>Owner</Text>
          <View style={styles.choiceRow}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: newActionOwner === 'me' }} onPress={() => setNewActionOwner('me')} style={[styles.choiceChip, newActionOwner === 'me' && styles.choiceChipActive]}>
              <Text style={[styles.choiceChipText, newActionOwner === 'me' && styles.choiceChipTextActive]}>Me</Text>
            </Pressable>
            {encounter.participants.map((person) => (
              <Pressable key={person.id} accessibilityRole="button" accessibilityState={{ selected: newActionOwner === person.id }} onPress={() => setNewActionOwner(person.id)} style={[styles.choiceChip, newActionOwner === person.id && styles.choiceChipActive]}>
                <Text style={[styles.choiceChipText, newActionOwner === person.id && styles.choiceChipTextActive]}>{person.name || 'Guest'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Channel</Text>
          <View style={styles.choiceRow}>
            {FOLLOW_UP_CHANNELS.map((channel) => (
              <Pressable key={channel.id} accessibilityRole="button" accessibilityState={{ selected: newActionChannel === channel.id }} onPress={() => setNewActionChannel(channel.id)} style={[styles.choiceChip, newActionChannel === channel.id && styles.choiceChipActive]}>
                <Text style={[styles.choiceChipText, newActionChannel === channel.id && styles.choiceChipTextActive]}>{channel.label}</Text>
              </Pressable>
            ))}
          </View>
          <FollowUpDuePicker dueAt={newActionDueAt} onChange={setNewActionDueAt} />
          <Button variant="secondary" disabled={!newActionTitle.trim()} onPress={addAction}>
            <Plus size={18} color={colors.ink} weight="bold" />
            Add action
          </Button>
        </View>
        {encounter.guestFollowUp?.committedAt ? (
          <View style={styles.statusRow}>
            <CheckCircle size={18} color={colors.accent} weight="fill" />
            <Text style={styles.summaryCopy}>
              Your guest said they&apos;ll follow up too{encounter.guestFollowUp.note ? `: "${encounter.guestFollowUp.note}"` : '.'}
            </Text>
          </View>
        ) : null}
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Guest sharing</Text>
        <View style={styles.statusRow}>
          <Switch
            accessibilityLabel="Enable guest sharing"
            value={guestSharingEnabled}
            onValueChange={toggleGuestSharing}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
          <Text style={styles.summaryCopy}>
            {guestSharingEnabled ? 'Guest sharing is on.' : 'Guest sharing is off. Turn on to prepare the shared link.'}
          </Text>
        </View>
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
          <>
            <Button loading={approving} disabled={!canApprove} onPress={() => void approveAndShare()}>
              Approve guest view
            </Button>
            {!canApprove ? (
              <Text style={styles.helperCopy}>
                {!guestSharingEnabled
                  ? 'Turn on guest sharing above to enable this.'
                  : 'Approve unlocks once the recording finishes uploading.'}
              </Text>
            ) : null}
          </>
        ) : guestUrl ? (
          <Button variant="secondary" onPress={() => void shareGuestLink()}>
            <ShareNetwork size={18} color={colors.ink} />
            Share guest link
          </Button>
        ) : null}
        {showEmailRecording ? (
          <>
            <Text style={[styles.label, styles.guestShareLabel]}>Or share the recording another way</Text>
            <View style={styles.secondaryActionsRow}>
              <Button variant="ghost" style={styles.secondaryActionsRowItem} onPress={() => void emailRecordingWithDetails()}>
                <EnvelopeSimple size={18} color={colors.ink} />
                Email
              </Button>
              <Button variant="ghost" style={styles.secondaryActionsRowItem} onPress={() => void shareRecordingFile()}>
                <ShareNetwork size={18} color={colors.ink} />
                Send file
              </Button>
            </View>
          </>
        ) : null}
      </Panel>

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
  guestShareLabel: { marginTop: spacing.x4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  helperCopy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  approveHint: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  uploadFailed: { gap: spacing.x2 },
  uploadFailedText: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  secondaryActionsRow: { flexDirection: 'row', gap: spacing.x2 },
  secondaryActionsRowItem: { flex: 1 },
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
  privateNotesField: { height: 110, maxHeight: 110, paddingTop: spacing.x3, textAlignVertical: 'top' },
  summaryCopy: { color: colors.ink, fontSize: 15, lineHeight: 22, flex: 1 },
  peopleWrap: { gap: spacing.x2 },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  personChip: { paddingHorizontal: spacing.x3, paddingVertical: spacing.x2, borderRadius: radius.medium, backgroundColor: colors.canvas },
  personChipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  actionList: { gap: spacing.x2 },
  actionRow: { minHeight: 54, padding: spacing.x3, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderRadius: radius.medium, backgroundColor: colors.canvas },
  actionCopy: { flex: 1, gap: 2 },
  actionTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  actionTitleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  actionComposer: { marginTop: spacing.x2, paddingTop: spacing.x4, gap: spacing.x3, borderTopWidth: 1, borderTopColor: colors.line },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  choiceChip: { minHeight: 36, paddingHorizontal: spacing.x3, justifyContent: 'center', borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  choiceChipActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  choiceChipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  choiceChipTextActive: { color: colors.white },
  actions: { gap: spacing.x2 },
});
