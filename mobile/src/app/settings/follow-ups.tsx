import { router, useFocusEffect } from 'expo-router';
import { ListChecks, MagnifyingGlass, SortAscending } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { FollowUpAudienceSheet } from '@/components/follow-up-audience-sheet';
import { FollowUpMissingSheet } from '@/components/follow-up-missing-sheet';
import { FollowUpSortSheet } from '@/components/follow-up-sheets';
import { GroupedFollowUpActions, GroupedFollowUpCell } from '@/components/grouped-follow-up-cell';
import { GreenHeroCard } from '@/components/green-hero-card';
import { MiniPromptCard } from '@/components/mini-prompt-card';
import { CaptureListSkeleton } from '@/components/skeleton';
import { BackButton, Body, Eyebrow } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { fetchFollowUps, type FollowUpItem } from '@/features/follow-ups/follow-up-api';
import {
  buildFollowUpGroups,
  filterFollowUpGroups,
  sortFollowUpGroups,
  type FollowUpScope,
  type FollowUpSort,
} from '@/features/follow-ups/follow-up-list';
import type { FollowUpGroup } from '@/features/follow-ups/follow-up-groups';
import { useFollowUpActions } from '@/features/follow-ups/use-follow-up-actions';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export default function FollowUpsScreen() {
  const { session } = useAuth();
  const insets = useAppInsets();
  const [scope, setScope] = useState<FollowUpScope>('current');
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<FollowUpSort>('urgency');
  const [sortOpen, setSortOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<FollowUpGroup | null>(null);

  const {
    runFollowUp,
    markComplete,
    completingId,
    missingOpen,
    missingExecution,
    missingLoading,
    closeMissing,
    requestMissingField,
    draftRequestEmail,
    audienceOpen,
    audienceItem,
    audienceParticipants,
    confirmAudience,
    closeAudience,
  } = useFollowUpActions(session?.access_token, {
    allFollowUps: followUps,
  });

  const loadFollowUps = useCallback(async () => {
    if (!session?.access_token) {
      setFollowUps([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setFollowUps(await fetchFollowUps(session.access_token));
    } catch (caught) {
      setFollowUps([]);
      setError(caught instanceof Error ? caught.message : 'Could not load follow-ups.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      void loadFollowUps();
    }, [loadFollowUps]),
  );

  const scopedGroups = useMemo(
    () => buildFollowUpGroups(followUps, scope),
    [followUps, scope],
  );

  const visibleGroups = useMemo(
    () => sortFollowUpGroups(filterFollowUpGroups(scopedGroups, query), sort),
    [query, scopedGroups, sort],
  );

  const hasFollowUps = scopedGroups.length > 0;

  function changeScope(nextScope: FollowUpScope) {
    setScope(nextScope);
    setSort(nextScope === 'past' ? 'recent' : 'urgency');
  }

  function runGroupFollowUp(group: FollowUpGroup) {
    if (group.items.length === 1) {
      runFollowUp(group.items[0]);
      return;
    }
    setActiveGroup(group);
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.headerCopy}>
            <Eyebrow>Follow-ups</Eyebrow>
            <Text style={styles.title}>Stay on top of next steps</Text>
            <Body>
              {scope === 'current'
                ? 'Open actions you still need to take.'
                : 'Follow-ups you already checked off.'}
            </Body>
          </View>

          <View style={styles.tabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === 'current' }}
              onPress={() => changeScope('current')}
              style={[styles.tab, scope === 'current' && styles.tabActive]}>
              <Text style={[styles.tabLabel, scope === 'current' && styles.tabLabelActive]}>Current</Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === 'past' }}
              onPress={() => changeScope('past')}
              style={[styles.tab, scope === 'past' && styles.tabActive]}>
              <Text style={[styles.tabLabel, scope === 'past' && styles.tabLabelActive]}>Past</Text>
            </Pressable>
          </View>

          {session && hasFollowUps ? (
            <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <MagnifyingGlass size={18} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search follow-ups"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sort follow-ups"
                onPress={() => setSortOpen(true)}
                style={styles.sortButton}>
                <SortAscending size={20} color={colors.ink} weight="bold" />
              </Pressable>
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.x6 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {!session ? (
            <GreenHeroCard
              icon={<ListChecks size={28} color={colors.white} weight="bold" />}
              title="Sign in to see follow-ups"
              copy="Pick follow-up channels in capture and they will show up here."
              primaryLabel="Sign in"
              onPrimary={() => router.push('/auth')}
            />
          ) : loading ? (
            <CaptureListSkeleton count={6} />
          ) : error ? (
            <MiniPromptCard
              icon={<ListChecks size={18} color={colors.ink} weight="bold" />}
              title="Could not load follow-ups"
              copy={error}
              onPress={() => void loadFollowUps()}
            />
          ) : hasFollowUps ? (
            <View style={styles.list}>
              {visibleGroups.map((group) => (
                <GroupedFollowUpCell
                  key={group.id}
                  group={group}
                  onPress={() => runGroupFollowUp(group)}
                  onComplete={() => {
                    const item = group.items[0];
                    if (item) void markComplete(item, loadFollowUps);
                  }}
                  completing={group.items.length === 1 && completingId === `${group.items[0]?.encounterId}-${group.items[0]?.actionId}`}
                />
              ))}
              {!visibleGroups.length ? (
                <Body style={styles.emptySearch}>No follow-ups match your search.</Body>
              ) : null}
            </View>
          ) : (
            <MiniPromptCard
              icon={<ListChecks size={18} color={colors.ink} weight="bold" />}
              title={scope === 'current' ? 'No current follow-ups' : 'No past follow-ups yet'}
              copy={scope === 'current'
                ? 'Pick follow-up channels in capture and they will show up here.'
                : 'Completed follow-ups will appear here after you check them off.'}
              onPress={scope === 'current' ? () => router.push('/capture') : undefined}
            />
          )}
        </ScrollView>
      </View>

      <FollowUpSortSheet
        visible={sortOpen}
        sort={sort}
        onClose={() => setSortOpen(false)}
        onSelect={setSort}
      />

      <BottomSheet
        visible={Boolean(activeGroup)}
        title={activeGroup?.personName.trim() || 'Follow-up actions'}
        onClose={() => setActiveGroup(null)}>
        {activeGroup ? (
          <GroupedFollowUpActions
            group={activeGroup}
            completingId={completingId}
            onPressItem={(actionId) => {
              const item = activeGroup.items.find((entry) => entry.actionId === actionId);
              if (item) runFollowUp(item);
            }}
            onCompleteItem={(actionId) => {
              const item = activeGroup.items.find((entry) => entry.actionId === actionId);
              if (item) void markComplete(item, loadFollowUps);
            }}
          />
        ) : null}
      </BottomSheet>

      <FollowUpMissingSheet
        visible={missingOpen}
        execution={missingExecution}
        loading={missingLoading}
        onClose={closeMissing}
        onRequest={() => void requestMissingField()}
        onDraftEmail={() => void draftRequestEmail()}
      />

      <FollowUpAudienceSheet
        visible={audienceOpen}
        item={audienceItem}
        participants={audienceParticipants}
        onClose={closeAudience}
        onConfirm={confirmAudience}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1 },
  header: { gap: spacing.x3, paddingHorizontal: spacing.x5 },
  headerCopy: { gap: spacing.x2, marginBottom: spacing.x1 },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.x2,
    padding: spacing.x1,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.x3,
    borderRadius: radius.round,
  },
  tabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  tabLabelActive: { color: colors.ink, fontWeight: '800' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
  },
  searchField: {
    flex: 1,
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
  sortButton: {
    width: 46,
    height: 46,
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scroll: { flex: 1, marginTop: spacing.x2 },
  scrollContent: { paddingHorizontal: spacing.x5, gap: spacing.x3, paddingTop: spacing.x2 },
  list: { gap: spacing.x2 },
  emptySearch: { textAlign: 'center', color: colors.muted },
});
