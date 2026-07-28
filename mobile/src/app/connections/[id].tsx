import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CaretRight, IdentificationCard, Trash } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionCardSheet } from '@/components/connection-card-sheet';
import { BottomSheet } from '@/components/bottom-sheet';
import { ConnectionDeleteSheet } from '@/components/connection-delete-sheet';
import { FollowUpCell } from '@/components/follow-up-cell';
import { FollowUpMissingSheet } from '@/components/follow-up-missing-sheet';
import { FollowUpsSheet } from '@/components/follow-ups-sheet';
import { MeetingDetailSheet } from '@/components/meeting-detail-sheet';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { OutcomeSuccessSheet } from '@/components/outcome-success-sheet';
import { ConnectionDetailSkeleton } from '@/components/skeleton';
import { BackButton, Body, Eyebrow, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { loadConnectionLiveCard } from '@/features/connections/connection-card-loader';
import {
  findSavedDirectoryContact,
  resolveDirectorySaveState,
  directoryUpdateSummary,
  type SavedDirectoryContact,
} from '@/features/connections/connection-directory';
import {
  fetchContacts,
  connectionSourceLabel,
  deleteConnection,
  fetchAllConnectionsMerged,
  type ConnectionItem,
} from '@/features/connections/connections-api';
import {
  saveConnectionToAfterMeet,
  saveConnectionToDeviceContacts,
  updateConnectionDirectory,
} from '@/features/connections/save-connection-contact';
import type { MobileCard } from '@/features/card/types';
import type { EncounterPayload } from '@/features/encounters/encounter-api';
import { findLocalRecordingUri } from '@/features/encounters/local-recordings';
import {
  fetchEncountersForConnection,
  fetchFollowUps,
  followUpsForPerson,
  type FollowUpItem,
} from '@/features/follow-ups/follow-up-api';
import { useFollowUpActions } from '@/features/follow-ups/use-follow-up-actions';
import { formatMeetingDate } from '@/lib/due-date';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ConnectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const insets = useAppInsets();
  const [connection, setConnection] = useState<ConnectionItem | null>(null);
  const [card, setCard] = useState<MobileCard | null>(null);
  const [meetings, setMeetings] = useState<EncounterPayload[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cardSlug, setCardSlug] = useState<string | null>(null);
  const [savedContact, setSavedContact] = useState<SavedDirectoryContact | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successSheetOpen, setSuccessSheetOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [cardSheetOpen, setCardSheetOpen] = useState(false);
  const [meetingsSheetOpen, setMeetingsSheetOpen] = useState(false);
  const [followUpsSheetOpen, setFollowUpsSheetOpen] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<EncounterPayload | null>(null);
  const [meetingRecordingUri, setMeetingRecordingUri] = useState<string | null>(null);
  const {
    runFollowUp,
    markComplete,
    completingId,
    missingOpen,
    missingExecution,
    missingLoading,
    googleConnected,
    closeMissing,
    requestMissingField,
    draftTailoredEmail,
    draftPreferredEmail,
  } = useFollowUpActions(session?.access_token);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorSheetOpen(true);
  }, []);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setSuccessSheetOpen(true);
  }, []);

  const loadConnection = useCallback(async () => {
    if (!session?.access_token || !id) {
      setConnection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const connections = await fetchAllConnectionsMerged(session.access_token);
      const match = connections.find((item) => item.id === decodeURIComponent(id));
      setConnection(match || null);
      if (!match) showError('This connection could not be found.');
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'Could not load this connection.');
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, [id, session?.access_token, showError]);

  const loadMeetingsAndFollowUps = useCallback(async (current: ConnectionItem) => {
    if (!session?.access_token) return;
    try {
      const [nextMeetings, allFollowUps] = await Promise.all([
        fetchEncountersForConnection(session.access_token, {
          connectionId: current.id,
          sourceId: current.sourceId,
          email: current.email,
          exchangeId: current.source === 'inbound' ? current.sourceId : undefined,
        }),
        fetchFollowUps(session.access_token),
      ]);
      setMeetings(nextMeetings);
      setFollowUps(followUpsForPerson(allFollowUps, current.name, current.email));
    } catch {
      setMeetings([]);
      setFollowUps([]);
    }
  }, [session?.access_token]);

  const loadCard = useCallback(async (current: ConnectionItem) => {
    if (!session?.access_token) return;
    setCardLoading(true);
    try {
      const result = await loadConnectionLiveCard(current, session.access_token);
      setCard(result.card);
      setCardSlug(result.slug);
    } finally {
      setCardLoading(false);
    }
  }, [session?.access_token]);

  const loadSavedDirectoryContact = useCallback(async (current: ConnectionItem, slug: string | null) => {
    if (!session?.access_token) {
      setSavedContact(null);
      return;
    }
    setDirectoryLoading(true);
    try {
      const contacts = await fetchContacts(session.access_token);
      setSavedContact(findSavedDirectoryContact(contacts, current, slug));
    } catch {
      setSavedContact(null);
    } finally {
      setDirectoryLoading(false);
    }
  }, [session?.access_token]);

  const refreshFollowUps = useCallback(async () => {
    if (!session?.access_token || !connection) return;
    try {
      const allFollowUps = await fetchFollowUps(session.access_token);
      setFollowUps(followUpsForPerson(allFollowUps, connection.name, connection.email));
    } catch {
      setFollowUps([]);
    }
  }, [connection, session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      void loadConnection();
    }, [loadConnection]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!connection) return;
      void loadCard(connection);
      void loadMeetingsAndFollowUps(connection);
    }, [connection, loadCard, loadMeetingsAndFollowUps]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!connection) return;
      void loadSavedDirectoryContact(connection, cardSlug);
    }, [connection, cardSlug, loadSavedDirectoryContact]),
  );

  const directoryState = useMemo(
    () => (connection ? resolveDirectorySaveState(savedContact, connection, card) : 'unsaved'),
    [savedContact, connection, card],
  );

  const directoryHint = useMemo(
    () => (connection ? directoryUpdateSummary(savedContact, connection, card) : ''),
    [savedContact, connection, card],
  );

  const meetingPreview = useMemo(() => meetings.slice(0, 3), [meetings]);
  const followUpPreview = useMemo(() => followUps.slice(0, 2), [followUps]);

  async function confirmDelete() {
    if (!session?.access_token || !connection) return;
    setDeleting(true);
    try {
      await deleteConnection(session.access_token, connection);
      setDeleteOpen(false);
      router.back();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'Could not remove this connection.');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function saveToDirectory() {
    if (!session?.access_token || !connection) return;
    setSaving(true);
    try {
      if (directoryState === 'needs_update') {
        await updateConnectionDirectory(session.access_token, connection, card);
        showSuccess('Directory updated with the latest card details.');
      } else {
        await saveConnectionToAfterMeet(session.access_token, connection, card);
        await saveConnectionToDeviceContacts(connection, card);
        showSuccess('Saved to your directory.');
      }
      await loadSavedDirectoryContact(connection, cardSlug);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not save this connection.';
      if (message.toLowerCase().includes('session has expired')) {
        showError('Your app session could not reach AfterMeet. Sign out from Settings, sign in again, then retry.');
      } else {
        showError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function openMeeting(meeting: EncounterPayload) {
    setActiveMeeting(meeting);
    const localUri = await findLocalRecordingUri(meeting.id);
    setMeetingRecordingUri(localUri);
  }

  function runConnectionFollowUp(item: FollowUpItem) {
    if (!connection) return;
    runFollowUp(item, { connection, card });
  }

  const contextLine = connection?.subtitle || connectionSourceLabel(connection?.source || 'met');
  const meetingCountLabel = meetings.length === 1
    ? '1 conversation'
    : `${meetings.length} conversations`;

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            {connection ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove connection"
                onPress={() => setDeleteOpen(true)}
                style={styles.deleteButton}>
                <Trash size={20} color={colors.danger} weight="bold" />
              </Pressable>
            ) : null}
          </View>
          {connection ? (
            <View style={styles.headerCopy}>
              <Title style={styles.name}>{connection.name}</Title>
              <Eyebrow>{connectionSourceLabel(connection.source)}</Eyebrow>
              <Body>{contextLine}</Body>
              {meetings.length ? <Body style={styles.countLine}>{meetingCountLabel}</Body> : null}
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.x6 }]}
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <ConnectionDetailSkeleton />
          ) : connection ? (
            <View style={styles.content}>
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Meetings</Text>
                  {meetings.length > 3 ? (
                    <Pressable accessibilityRole="button" onPress={() => setMeetingsSheetOpen(true)}>
                      <Text style={styles.viewAll}>View all</Text>
                    </Pressable>
                  ) : null}
                </View>
                {meetingPreview.length ? (
                  meetingPreview.map((meeting) => (
                    <Pressable
                      key={meeting.id}
                      accessibilityRole="button"
                      onPress={() => void openMeeting(meeting)}
                      style={({ pressed }) => [styles.meetingCell, pressed && styles.pressed]}>
                      <View style={styles.meetingCopy}>
                        <Text style={styles.meetingTitle} numberOfLines={1}>
                          {meeting.title.trim() || 'Meeting'}
                        </Text>
                        <Text style={styles.meetingMeta}>{formatMeetingDate(meeting.startedAt)}</Text>
                        {meeting.sharedSummary.trim() ? (
                          <Text style={styles.meetingSummary} numberOfLines={2}>{meeting.sharedSummary.trim()}</Text>
                        ) : null}
                      </View>
                      <CaretRight size={16} color={colors.muted} weight="bold" />
                    </Pressable>
                  ))
                ) : (
                  <Body style={styles.empty}>Capture a meeting with {connection.name.split(' ')[0] || 'them'} to build history here.</Body>
                )}
              </View>

              {followUps.length ? (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Follow-ups</Text>
                    {followUps.length > 2 ? (
                      <Pressable accessibilityRole="button" onPress={() => setFollowUpsSheetOpen(true)}>
                        <Text style={styles.viewAll}>View all</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.list}>
                    {followUpPreview.map((item) => (
                      <FollowUpCell
                        key={`${item.encounterId}-${item.actionId}`}
                        item={item}
                        onPress={() => runConnectionFollowUp(item)}
                        onComplete={() => void markComplete(item, refreshFollowUps)}
                        completing={completingId === `${item.encounterId}-${item.actionId}`}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => setCardSheetOpen(true)}
                style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}>
                <IdentificationCard size={20} color={colors.ink} weight="bold" />
                <View style={styles.cardButtonCopy}>
                  <Text style={styles.cardButtonTitle}>View card & directory</Text>
                  <Text style={styles.cardButtonMeta}>
                    {directoryState === 'saved'
                      ? 'Saved to directory'
                      : directoryState === 'needs_update'
                        ? directoryHint || 'Update directory'
                        : 'Save their card details'}
                  </Text>
                </View>
                <CaretRight size={16} color={colors.muted} weight="bold" />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <ConnectionCardSheet
        visible={cardSheetOpen}
        connection={connection}
        card={cardLoading && !card ? null : card}
        directoryState={directoryState}
        loading={saving || directoryLoading}
        onClose={() => setCardSheetOpen(false)}
        onSaveDirectory={() => void saveToDirectory()}
      />

      <BottomSheet visible={meetingsSheetOpen} title="Meetings" onClose={() => setMeetingsSheetOpen(false)}>
        <View style={styles.list}>
          {meetings.map((meeting) => (
            <Pressable
              key={meeting.id}
              accessibilityRole="button"
              onPress={() => {
                setMeetingsSheetOpen(false);
                void openMeeting(meeting);
              }}
              style={({ pressed }) => [styles.meetingCell, pressed && styles.pressed]}>
              <View style={styles.meetingCopy}>
                <Text style={styles.meetingTitle} numberOfLines={1}>{meeting.title.trim() || 'Meeting'}</Text>
                <Text style={styles.meetingMeta}>{formatMeetingDate(meeting.startedAt)}</Text>
              </View>
              <CaretRight size={16} color={colors.muted} weight="bold" />
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <MeetingDetailSheet
        visible={Boolean(activeMeeting)}
        encounter={activeMeeting}
        recordingUri={meetingRecordingUri}
        followUps={activeMeeting ? followUps.filter((item) => item.encounterId === activeMeeting.id) : []}
        onClose={() => {
          setActiveMeeting(null);
          setMeetingRecordingUri(null);
        }}
        onPressFollowUp={runConnectionFollowUp}
        onCompleteFollowUp={(item) => void markComplete(item, refreshFollowUps)}
      />

      <FollowUpsSheet
        visible={followUpsSheetOpen}
        title={`Follow-ups · ${connection?.name || ''}`}
        items={followUps}
        onClose={() => setFollowUpsSheetOpen(false)}
        onPressItem={runConnectionFollowUp}
        onCompleteItem={(item) => void markComplete(item, refreshFollowUps)}
        completingId={completingId}
      />

      <FollowUpMissingSheet
        visible={missingOpen}
        execution={missingExecution}
        loading={missingLoading}
        googleConnected={googleConnected}
        onClose={closeMissing}
        onRequest={() => void requestMissingField()}
        onDraftTailoredEmail={(preferGmail) => void draftTailoredEmail(preferGmail)}
        onDraftPreferredEmail={(preferGmail) => void draftPreferredEmail(preferGmail)}
      />

      <ConnectionDeleteSheet
        visible={deleteOpen}
        name={connection?.name || 'this connection'}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1 },
  header: { gap: spacing.x3, paddingHorizontal: spacing.x5 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  headerCopy: { gap: spacing.x2 },
  name: { fontSize: 32, lineHeight: 34 },
  countLine: { color: colors.muted, fontSize: 13 },
  scroll: { flex: 1, marginTop: spacing.x3 },
  scrollContent: { paddingHorizontal: spacing.x5, gap: spacing.x3 },
  content: { gap: spacing.x5 },
  section: { gap: spacing.x3 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  viewAll: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  list: { gap: spacing.x3 },
  meetingCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.86 },
  meetingCopy: { flex: 1, gap: 2 },
  meetingTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  meetingMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  meetingSummary: { color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
  },
  cardButtonCopy: { flex: 1, gap: 2 },
  cardButtonTitle: { color: colors.white, fontSize: 15, fontWeight: '800' },
  cardButtonMeta: { color: '#C5D3BF', fontSize: 12, lineHeight: 16 },
});
