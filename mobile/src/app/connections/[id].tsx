import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Trash } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionDeleteSheet } from '@/components/connection-delete-sheet';
import { MobileCardPreview } from '@/components/mobile-card';
import { BackButton, Body, Button, Eyebrow } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { loadConnectionLiveCard } from '@/features/connections/connection-card-loader';
import {
  connectionSourceLabel,
  deleteConnection,
  fetchAllConnections,
  type ConnectionItem,
} from '@/features/connections/connections-api';
import {
  saveConnectionToAfterMeet,
  saveConnectionToDeviceContacts,
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadConnection = useCallback(async () => {
    if (!session?.access_token || !id) {
      setConnection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const connections = await fetchAllConnections(session.access_token);
      const match = connections.find((item) => item.id === decodeURIComponent(id));
      setConnection(match || null);
      if (!match) setError('This connection could not be found.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this connection.');
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, [id, session?.access_token]);

  const loadCard = useCallback(async (current: ConnectionItem) => {
    if (!session?.access_token) return;
    setCardLoading(true);
    try {
      const result = await loadConnectionLiveCard(current, session.access_token);
      setCard(result.card);
    } finally {
      setCardLoading(false);
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

  async function confirmDelete() {
    if (!session?.access_token || !connection) return;
    setDeleting(true);
    try {
      await deleteConnection(session.access_token, connection);
      setDeleteOpen(false);
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this connection.');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function saveToDirectory() {
    if (!session?.access_token || !connection) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await saveConnectionToAfterMeet(session.access_token, connection, card);
      await saveConnectionToDeviceContacts(connection, card);
      setMessage('Saved to your directory.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this connection.');
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
            <View style={styles.centered}>
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : error && !connection ? (
            <View style={styles.centered}>
              <Body>{error}</Body>
            </View>
          ) : connection ? (
            <View style={styles.cardWrap}>
              {cardLoading && !card ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={colors.ink} />
                </View>
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

              <Button loading={saving} onPress={() => void saveToDirectory()}>
                Save to directory
              </Button>

              {message ? <Text style={styles.success}>{message}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
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
  centered: { paddingVertical: spacing.x6, alignItems: 'center' },
  cardWrap: { gap: spacing.x3 },
  emptyCard: {
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  readOnlyNote: { textAlign: 'center', color: colors.muted, fontSize: 13, lineHeight: 18 },
  success: { color: colors.ink, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center', fontSize: 13 },
});
