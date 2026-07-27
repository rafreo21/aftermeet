import { router, useLocalSearchParams } from 'expo-router';
import { Microphone, ShareNetwork } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { CollapsibleTranscriptSection } from '@/components/collapsible-transcript-section';
import { RecordingPlayback } from '@/components/recording-playback';
import { Body, Button, PageHeader, Panel, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  findLocalRecordingUri,
  formatDuration,
  readLocalRecordingMetadata,
} from '@/features/encounters/local-recordings';
import {
  generateOutboundDraft,
  getEncounter,
  saveEncounter,
  uploadEncounterRecording,
  type EncounterPayload,
} from '@/features/encounters/encounter-api';
import { readEnv } from '@/lib/env';
import { colors, radius, spacing } from '@/theme/tokens';

function resolveSharedRecordingUrl(recording?: EncounterPayload['recording']) {
  if (!recording?.sharedAudioUrl) return null;
  const base = readEnv()?.publicCardBaseUrl?.replace(/\/+$/, '');
  if (!base) return recording.sharedAudioUrl.startsWith('http') ? recording.sharedAudioUrl : null;
  if (recording.sharedAudioUrl.startsWith('http')) return recording.sharedAudioUrl;
  return `${base}${recording.sharedAudioUrl.startsWith('/') ? '' : '/'}${recording.sharedAudioUrl}`;
}

export default function CaptureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [encounter, setEncounter] = useState<EncounterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(true);

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
        let uri = localUri || resolveSharedRecordingUrl(nextEncounter.recording);
        if (!uri && localUri && session.access_token) {
          try {
            const uploaded = await uploadEncounterRecording(
              session.access_token,
              nextEncounter.id,
              localUri,
              nextEncounter.recording?.mimeType,
            );
            if (uploaded?.sharedAudioUrl) {
              uri = resolveSharedRecordingUrl({ sharedAudioUrl: uploaded.sharedAudioUrl } as EncounterPayload['recording']) || localUri;
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
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load this meeting.'))
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
    setError('');
    try {
      await saveEncounter(session.access_token, next);
      setEncounter(next);
      setMessage('Changes saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save changes.');
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

  async function copyFollowUpDraft() {
    if (!session?.access_token || !encounter) return;
    setSaving(true);
    setError('');
    try {
      const body = await generateOutboundDraft(session.access_token, encounter);
      if (body) {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(body);
        setMessage('Follow-up draft copied.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not draft a follow-up.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']} reserveTabBar={false}>
        <ActivityIndicator color={colors.ink} style={{ marginTop: spacing.x8 }} />
      </Screen>
    );
  }

  if (!session || !encounter) {
    return (
      <Screen edges={['top', 'bottom']} reserveTabBar={false}>
        <PageHeader eyebrow="Previous" title="Meeting not available" titleStyle={styles.title} />
        <Body>{error || 'Sign in to view this meeting.'}</Body>
        {!session ? <Button onPress={() => router.push('/auth')}>Sign in</Button> : null}
        <Button variant="secondary" onPress={() => router.back()}>Go back</Button>
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
      <Body>Review notes, listen to the recording, and edit anything before you follow up.</Body>

      {hasRecording ? (
        <View style={styles.recorderCard}>
          <View style={styles.recorderHero}>
            <View style={styles.micOrb}>
              <Microphone size={28} color={colors.ink} weight="fill" />
            </View>
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
        <Text style={styles.sectionTitle}>Private to you</Text>
        <Text style={styles.label}>Private notes</Text>
        <TextInput
          value={encounter.privateNotes}
          onChangeText={(value) => setEncounter({ ...encounter, privateNotes: value })}
          multiline
          scrollEnabled
          style={[styles.input, styles.notesField]}
        />
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Shared meeting record</Text>
        <Text style={styles.label}>Shared summary</Text>
        <TextInput
          value={encounter.sharedSummary}
          onChangeText={(value) => setEncounter({ ...encounter, sharedSummary: value })}
          multiline
          scrollEnabled
          style={[styles.input, styles.notesField]}
        />
      </Panel>

      {encounter.actions[0] ? (
        <Panel style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-up</Text>
          <Text style={styles.bodyCopy}>{encounter.actions[0].title}</Text>
          <Button variant="secondary" loading={saving} onPress={() => void copyFollowUpDraft()}>
            Copy follow-up draft
          </Button>
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

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  actions: { gap: spacing.x2 },
  success: { color: '#2F5711', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
