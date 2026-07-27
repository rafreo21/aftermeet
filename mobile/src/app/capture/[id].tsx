import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Copy, ShareNetwork, Sparkle } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, PageHeader, Panel, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  buildEncounterPayload,
  extractEncounterDraft,
  generateOutboundDraft,
  getEncounter,
  saveEncounter,
  type EncounterPayload,
  type InboundExchange,
} from '@/features/encounters/encounter-api';
import { readEnv } from '@/lib/env';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CaptureReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [encounter, setEncounter] = useState<EncounterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const guestUrl = encounter && readEnv()
    ? `${readEnv()!.publicCardBaseUrl}/e/${encounter.shareToken}`
    : '';

  useEffect(() => {
    if (!session?.access_token || !id) {
      setLoading(false);
      return;
    }
    void getEncounter(session.access_token, id)
      .then(setEncounter)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load this meeting.'))
      .finally(() => setLoading(false));
  }, [id, session?.access_token]);

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

  async function approveAndShare() {
    if (!encounter) return;
    const next = { ...encounter, status: 'shared' as const };
    await persist(next);
    setMessage('Shared view is ready. Nothing has been sent automatically.');
  }

  async function copyGuestLink() {
    if (!guestUrl) return;
    await Clipboard.setStringAsync(guestUrl);
    setMessage('Guest link copied.');
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
        <PageHeader eyebrow="Review" title="Meeting not available" titleStyle={styles.title} />
        <Body>{error || 'Sign in to review this meeting.'}</Body>
        {!session ? <Button onPress={() => router.push('/auth')}>Sign in</Button> : null}
        <Button variant="secondary" onPress={() => router.back()}>Go back</Button>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} reserveTabBar={false}>
      <PageHeader
        eyebrow="Step 5 · Review"
        title={encounter.personName || encounter.title}
        titleStyle={styles.title}
      />
      <Body>Decide what stays private, what is shared, and copy the guest link when you are ready.</Body>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Private to you</Text>
        <Text style={styles.label}>Private notes</Text>
        <TextInput
          value={encounter.privateNotes}
          onChangeText={(value) => setEncounter({ ...encounter, privateNotes: value })}
          multiline
          style={[styles.input, styles.textarea]}
        />
        {encounter.transcript ? (
          <>
            <Text style={styles.label}>Transcript</Text>
            <TextInput
              value={encounter.transcript}
              onChangeText={(value) => setEncounter({ ...encounter, transcript: value })}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </>
        ) : null}
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Shared meeting record</Text>
        <Text style={styles.label}>Shared summary</Text>
        <TextInput
          value={encounter.sharedSummary}
          onChangeText={(value) => setEncounter({ ...encounter, sharedSummary: value })}
          multiline
          style={[styles.input, styles.textarea]}
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
        {encounter.status !== 'shared' ? (
          <Button variant="secondary" loading={saving} onPress={() => void approveAndShare()}>
            <CheckCircle size={18} color={colors.ink} weight="fill" />
            Approve shared record
          </Button>
        ) : null}
        {guestUrl ? (
          <>
            <Button variant="secondary" onPress={() => void copyGuestLink()}>
              <Copy size={18} color={colors.ink} /> Copy guest link
            </Button>
            <Button variant="secondary" onPress={() => void shareGuestLink()}>
              <ShareNetwork size={18} color={colors.ink} /> Share guest link
            </Button>
          </>
        ) : null}
        <Button variant="ghost" onPress={() => router.replace('/(tabs)')}>Done</Button>
      </View>

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 32 },
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
  textarea: { minHeight: 110, paddingTop: spacing.x3, textAlignVertical: 'top' },
  actions: { gap: spacing.x2 },
  success: { color: '#2F5711', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
