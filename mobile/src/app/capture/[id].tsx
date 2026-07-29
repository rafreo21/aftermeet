import { router, useLocalSearchParams } from 'expo-router';
import { Microphone, ShareNetwork } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { CollapsibleTranscriptSection } from '@/components/collapsible-transcript-section';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { OutcomeSuccessSheet } from '@/components/outcome-success-sheet';
import { RecordingPlayback, RecordingPlayOrb } from '@/components/recording-playback';
import { ConnectionDetailSkeleton } from '@/components/skeleton';
import { Body, Button, PageHeader, Panel, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  findLocalRecordingUri,
  formatDuration,
  readLocalRecordingMetadata,
  resolveSharedRecordingUrl,
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
import { readEnv } from '@/lib/env';
import { colors, radius, spacing } from '@/theme/tokens';

function resolveSharedRecordingUrlFromEncounter(recording?: EncounterPayload['recording']) {
  return resolveSharedRecordingUrl(recording);
}

export default function CaptureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [encounter, setEncounter] = useState<EncounterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (!session?.access_token || !id) {
      setLoading(false);
      setRecordingLoading(false);
      return;
    }
    void Promise.all([
      getEncounter(session.access_token, id),
      findLocalRecordingUri(id),
      readLocalRecordingMetadata(id),
    ])
      .then(async ([nextEncounter, localUri]) => {
        setEncounter(nextEncounter);
        let uri = localUri || resolveSharedRecordingUrlFromEncounter(nextEncounter.recording);
        if (!uri && localUri && session.access_token) {
          try {
            const uploaded = await uploadEncounterRecording(
              session.access_token,
              nextEncounter.id,
              localUri,
              nextEncounter.recording?.mimeType,
            );
            if (uploaded?.sharedAudioUrl) {
              uri = resolveSharedRecordingUrlFromEncounter({ sharedAudioUrl: uploaded.sharedAudioUrl } as EncounterPayload['recording']) || localUri;
              setEncounter((current) => current ? {
                ...current,
                recording: {
                  ...(current.recording ?? {
                    id: current.id,
                    durationSeconds: current.durationSeconds,
                    fileSize: 0,
                    mimeType: 'audio/mp4',
                    source: 'recorded',
                    retention: '7_days',
                    expiresAt: null,
                    createdAt: current.startedAt,
                    localUri,
                  }),
                  sharedAudioUrl: uploaded.sharedAudioUrl,
                  audioLocation: 'server',
                },
              } : current);
            }
          } catch {
            uri = localUri;
          }
        }
        setRecordingUri(uri);
      })
      .catch((caught) => {
        setErrorMessage(caught instanceof Error ? caught.message : 'Could not load this meeting.');
        setErrorSheetOpen(true);
      })
      .finally(() => {
        setLoading(false);
        setRecordingLoading(false);
      });
  }, [id, session?.access_token]);

  const recordingDuration = useMemo(
    () => encounter?.durationSeconds || encounter?.recording?.durationSeconds || 0,
    [encounter?.durationSeconds, encounter?.recording?.durationSeconds],
  );

  const hasRecording = Boolean(recordingUri || encounter?.recording || encounter?.durationSeconds);

  async function persist(next: EncounterPayload) {
    if (!session?.access_token) return;
    setSaving(true);
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

  async function shareGuestLink() {
    if (!guestUrl || !encounter) return;
    await Share.share({
      title: `${encounter.personName || encounter.title} · AfterMeet`,
      message: guestUrl,
      url: guestUrl,
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

  return (
    <Screen edges={['top', 'bottom']} reserveTabBar={false}>
      <PageHeader
        eyebrow="Previous capture"
        title={encounter.personName || encounter.title}
        titleStyle={styles.title}
      />
      <Body>Review the share summary and follow-up plan, then save or share when you are ready.</Body>

      {hasRecording ? (
        <View style={styles.recorderCard}>
          <View style={styles.recorderHero}>
            {recordingUri ? (
              <RecordingPlayOrb uri={recordingUri} durationSeconds={recordingDuration} size={56} />
            ) : (
              <View style={styles.micOrb}>
                <Microphone size={28} color={colors.ink} weight="fill" />
              </View>
            )}
            <View style={styles.recorderMeta}>
              <Text style={styles.recorderTitle}>Recording</Text>
              <Text style={styles.recorderHint}>
                {recordingUri ? 'Saved on this device or synced to AfterMeet' : 'Recording metadata only'}
              </Text>
            </View>
            <Text style={styles.recorderTime}>{formatDuration(recordingDuration)}</Text>
          </View>

          {recordingLoading ? (
            <ActivityIndicator color={colors.ink} />
          ) : recordingUri ? (
            <RecordingPlayback uri={recordingUri} durationSeconds={recordingDuration} />
          ) : (
            <Text style={styles.recordingMissing}>
              Recording file is not available on this device. It may still be syncing from another session.
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
          onChangeText={(value) => setEncounter({ ...encounter, sharedSummary: value })}
          multiline
          scrollEnabled
          placeholder="What you discussed, decided, and who owns what next…"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.notesField]}
        />
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
        {guestUrl ? (
          <Button variant="secondary" onPress={() => void shareGuestLink()}>
            <ShareNetwork size={18} color={colors.ink} />
            Share guest link
          </Button>
        ) : null}
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
  recorderHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x4,
  },
  micOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  recorderMeta: { flex: 1, gap: 4 },
  recorderTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  recorderHint: { color: colors.muted, fontSize: 13 },
  recorderTime: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  recordingMissing: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  section: { gap: spacing.x3 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  bodyCopy: { color: colors.ink, fontSize: 15, lineHeight: 22 },
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
  summaryCopy: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  actions: { gap: spacing.x2 },
  success: { color: '#2F5711', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
