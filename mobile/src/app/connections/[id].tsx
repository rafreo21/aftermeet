import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Trash } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionDeleteSheet } from '@/components/connection-delete-sheet';
import { MobileCardPreview } from '@/components/mobile-card';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { OutcomeSuccessSheet } from '@/components/outcome-success-sheet';
import { ConnectionDetailSkeleton } from '@/components/skeleton';
import { BackButton, Body, Button, Eyebrow } from '@/components/ui';
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
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ConnectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const insets = useAppInsets();
  const [connection, setConnection] = useState<ConnectionItem | null>(null);
  const [card, setCard] = useState<MobileCard | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      void loadConnection();
    }, [loadConnection]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!connection) return;
      void loadCard(connection);
    }, [connection, loadCard]),
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

  const contextLine = connection?.subtitle || connectionSourceLabel(connection?.source || 'met');

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
              <Eyebrow>{connectionSourceLabel(connection.source)}</Eyebrow>
              <Body>{contextLine}</Body>
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
            <View style={styles.cardWrap}>
              {cardLoading && !card ? (
                <ConnectionDetailSkeleton />
              ) : card ? (
                <>
                  <MobileCardPreview card={card} />
                  <Body style={styles.readOnlyNote}>
                    {connection.cardSlug || connection.source !== 'inbound'
                      ? 'Live card — updates when they change it.'
                      : 'Card from their shared details. It updates live once their AfterMeet card is published.'}
                  </Body>
                </>
              ) : (
                <View style={styles.emptyCard}>
                  <Body>No published card yet. Save their details to your directory instead.</Body>
                </View>
              )}

              {directoryState === 'saved' ? (
                <Body style={styles.savedNote}>Saved to your AfterMeet directory.</Body>
              ) : directoryState === 'needs_update' && directoryHint ? (
                <Body style={styles.updateNote}>{directoryHint}</Body>
              ) : null}

              {directoryState === 'saved' ? (
                <Button variant="secondary" disabled>
                  Saved to directory
                </Button>
              ) : (
                <Button loading={saving || directoryLoading} onPress={() => void saveToDirectory()}>
                  {directoryState === 'needs_update' ? 'Update directory' : 'Save to directory'}
                </Button>
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>

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
  scroll: { flex: 1, marginTop: spacing.x3 },
  scrollContent: { paddingHorizontal: spacing.x5, gap: spacing.x3 },
  cardWrap: { gap: spacing.x3 },
  emptyCard: {
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  readOnlyNote: { textAlign: 'center', color: colors.muted, fontSize: 13, lineHeight: 18 },
  savedNote: { textAlign: 'center', color: colors.muted, fontSize: 13, lineHeight: 18 },
  updateNote: { textAlign: 'center', color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
});
