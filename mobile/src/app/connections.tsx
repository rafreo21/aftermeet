import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { CaretRight, MagnifyingGlass, UsersThree } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton, Body, Button, Eyebrow } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { connectionAvatarUrl } from '@/features/connections/connection-public-card';
import {
  connectionSourceLabel,
  fetchAllConnections,
  filterConnections,
  sortConnections,
  type ConnectionItem,
  type ConnectionSort,
} from '@/features/connections/connections-api';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

function formatWhen(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ConnectionRow({ connection, onPress }: { connection: ConnectionItem; onPress: () => void }) {
  const avatar = connection.photoUrl || connectionAvatarUrl(connection);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Image source={avatar} style={styles.avatar} contentFit="cover" />
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>{connection.name}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{connection.subtitle}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.source}>{connectionSourceLabel(connection.source)}</Text>
          {connection.connectedAt ? <Text style={styles.when}>{formatWhen(connection.connectedAt)}</Text> : null}
        </View>
      </View>
      <CaretRight size={16} color={colors.muted} weight="bold" />
    </Pressable>
  );
}

export default function ConnectionsScreen() {
  const { session } = useAuth();
  const insets = useAppInsets();
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ConnectionSort>('date');

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setConnections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setConnections(await fetchAllConnections(session.access_token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load connections.');
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visibleConnections = useMemo(
    () => sortConnections(filterConnections(connections, query), sort),
    [connections, query, sort],
  );

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <BackButton onPress={() => router.back()} />
            {connections.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search connections"
                onPress={() => setSearchOpen((value) => !value)}
                style={styles.searchButton}>
                <MagnifyingGlass size={20} color={colors.ink} weight="bold" />
              </Pressable>
            ) : null}
          </View>
          {connections.length ? (
            <View style={styles.headerCopy}>
              <Eyebrow>Connections</Eyebrow>
              <Text style={styles.title}>People you’ve met</Text>
              <Body>Cards you saved and people who shared their details with you.</Body>
            </View>
          ) : null}
          {connections.length ? (
            <View style={styles.toolbar}>
              {searchOpen ? (
                <View style={styles.searchField}>
                  <MagnifyingGlass size={18} color={colors.muted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search connections"
                    placeholderTextColor={colors.muted}
                    style={styles.searchInput}
                    autoFocus
                  />
                </View>
              ) : null}
              <View style={styles.sortRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSort('date')}
                  style={[styles.sortChip, sort === 'date' && styles.sortChipActive]}>
                  <Text style={[styles.sortChipText, sort === 'date' && styles.sortChipTextActive]}>Date added</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSort('az')}
                  style={[styles.sortChip, sort === 'az' && styles.sortChipActive]}>
                  <Text style={[styles.sortChipText, sort === 'az' && styles.sortChipTextActive]}>A–Z</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.x6 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {!session ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <UsersThree size={28} color={colors.ink} weight="bold" />
              </View>
              <Text style={styles.emptyTitle}>Sign in to see connections</Text>
              <Button onPress={() => router.push('/auth')}>Sign in</Button>
            </View>
          ) : loading ? (
            <Body style={styles.loadingCopy}>Loading connections…</Body>
          ) : error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Couldn’t load connections</Text>
              <Body style={styles.loadingCopy}>{error}</Body>
              <Button variant="secondary" onPress={() => void load()}>Try again</Button>
            </View>
          ) : connections.length ? (
            <View style={styles.list}>
              {visibleConnections.map((connection) => (
                <ConnectionRow
                  key={connection.id}
                  connection={connection}
                  onPress={() => router.push(`/connections/${encodeURIComponent(connection.id)}`)}
                />
              ))}
              {!visibleConnections.length ? (
                <Body style={styles.loadingCopy}>No connections match your search.</Body>
              ) : null}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <UsersThree size={28} color={colors.ink} weight="bold" />
              </View>
              <Text style={styles.emptyTitle}>No connections yet</Text>
              <Button onPress={() => router.push('/share-card')}>Share my card</Button>
              <Button variant="secondary" onPress={() => router.push('/scanner')}>Scan a card</Button>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1 },
  header: { gap: spacing.x3, paddingHorizontal: spacing.x5 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  headerCopy: { gap: spacing.x2 },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  toolbar: { gap: spacing.x2 },
  searchField: {
    minHeight: 46,
    paddingHorizontal: spacing.x3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  sortRow: { flexDirection: 'row', gap: spacing.x2 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sortChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  sortChipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  sortChipTextActive: { color: colors.white },
  scroll: { flex: 1, marginTop: spacing.x3 },
  scrollContent: { paddingHorizontal: spacing.x5, gap: spacing.x3 },
  list: { gap: spacing.x2 },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x3,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowPressed: { opacity: 0.84 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, marginTop: 4 },
  source: { color: colors.inkSoft, fontSize: 10, fontWeight: '700' },
  when: { color: colors.muted, fontSize: 10 },
  empty: {
    alignItems: 'center',
    gap: spacing.x3,
    paddingVertical: spacing.x6,
    paddingHorizontal: spacing.x2,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  loadingCopy: { textAlign: 'center', color: colors.muted },
});
