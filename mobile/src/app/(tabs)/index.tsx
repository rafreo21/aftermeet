import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  CaretRight,
  Clock,
  IdentificationCard,
  ListChecks,
  Microphone,
  Notebook,
  Plus,
  QrCode,
  Scan,
  UsersThree,
} from 'phosphor-react-native';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { MiniPromptCard } from '@/components/mini-prompt-card';
import { OfflineBanner } from '@/components/offline-banner';
import { ProgressRing } from '@/components/progress-ring';
import { Skeleton, SkeletonCircle, SkeletonLine } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useCard } from '@/features/card/card-context';
import {
  getActiveCaptureController,
  subscribeToActiveCapture,
} from '@/features/encounters/active-capture-controller';
import { fetchEncounters, type EncounterSummary } from '@/features/encounters/encounter-api';
import { formatDuration } from '@/features/encounters/local-recordings';
import { createFreshCaptureDraft, listCaptureDrafts, writeCaptureDraft, type CaptureDraftSummary } from '@/features/encounters/capture-draft';
import {
  connectionAvatarUrl,
} from '@/features/connections/connection-public-card';
import {
  fetchAllConnectionsMerged,
  sortConnections,
  type ConnectionItem,
} from '@/features/connections/connections-api';
import { fetchFollowUps, type FollowUpItem } from '@/features/follow-ups/follow-up-api';
import { summarizeFollowUpNudges } from '@/features/follow-ups/follow-up-nudges';
import { resolveFollowUpUserName } from '@/features/follow-ups/follow-up-participants';
import { fetchNotifications } from '@/features/notifications/notification-center-api';
import { formatRelativeTime } from '@/lib/relative-time';
import { useAppInsets, useTabBarHeight } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

type ActiveWorkItem = {
  key: string;
  icon: typeof Microphone;
  label: string;
  onPress: () => void;
};

export default function HomeScreen() {
  const insets = useAppInsets();
  const tabBarHeight = useTabBarHeight();
  const { session } = useAuth();
  const { card, cards, loading: cardLoading } = useCard();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [drafts, setDrafts] = useState<CaptureDraftSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  const activeCapture = useSyncExternalStore(
    subscribeToActiveCapture,
    getActiveCaptureController,
    getActiveCaptureController,
  );

  const greetingName = useMemo(() => {
    const name = resolveFollowUpUserName({
      activeCardName: card.name,
      cards,
      authName: String(session?.user.user_metadata?.full_name || session?.user.user_metadata?.name || ''),
      authEmail: session?.user.email || '',
    });
    return name.split(' ')[0] || '';
  }, [card.name, cards, session?.user.email, session?.user.user_metadata]);

  const load = useCallback(async () => {
    setLoadError('');
    const draftList = await listCaptureDrafts();
    setDrafts(draftList);

    if (!session?.access_token) {
      setFollowUps([]);
      setUnreadNotifications(0);
      setEncounters([]);
      setConnections([]);
      return;
    }

    const token = session.access_token;
    const [followUpsResult, notificationsResult, encountersResult, connectionsResult] = await Promise.allSettled([
      fetchFollowUps(token),
      fetchNotifications(token),
      fetchEncounters(token),
      fetchAllConnectionsMerged(token),
    ]);

    if (followUpsResult.status === 'fulfilled') setFollowUps(followUpsResult.value);
    if (notificationsResult.status === 'fulfilled') setUnreadNotifications(notificationsResult.value.unreadCount);
    if (encountersResult.status === 'fulfilled') setEncounters(encountersResult.value);
    if (connectionsResult.status === 'fulfilled') setConnections(connectionsResult.value);

    if ([followUpsResult, notificationsResult, encountersResult, connectionsResult].every((result) => result.status === 'rejected')) {
      setLoadError('Could not load your Home data. Check your connection and try again.');
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load().finally(() => {
        setLoading(false);
        setHasLoadedOnce(true);
      });
      const interval = setInterval(() => void load(), 30_000);
      return () => clearInterval(interval);
    }, [load]),
  );

  const attention = useMemo(() => {
    const nudge = summarizeFollowUpNudges(followUps);
    const completed = followUps.filter((item) => item.status === 'completed').length;
    const total = followUps.length;
    const rate = total ? Math.round((completed / total) * 100) : 0;
    if (nudge) {
      return { headline: nudge.headline, completed, total, rate, urgent: true, hasData: true };
    }
    if (total) {
      return { headline: 'You’re all caught up', completed, total, rate, urgent: false, hasData: true };
    }
    return { headline: 'No follow-ups yet', completed: 0, total: 0, rate: 0, urgent: false, hasData: false };
  }, [followUps]);

  const pendingReviewCount = useMemo(
    () => encounters.filter((item) => item.status === 'draft').length,
    [encounters],
  );

  const activeCaptureId = activeCapture?.snapshot.encounterId;

  async function startCaptureNow() {
    setFabOpen(false);
    if (activeCapture) {
      router.navigate({
        pathname: '/capture/new',
        params: { draftId: activeCapture.snapshot.encounterId },
      });
      return;
    }
    const draft = { ...createFreshCaptureDraft(), captureMode: 'recording' as const };
    await writeCaptureDraft(draft);
    router.navigate({
      pathname: '/capture/new',
      params: { draftId: draft.encounterId, openConsent: '1' },
    });
  }

  const draftCount = useMemo(
    () => drafts.filter((item) => item.encounterId !== activeCaptureId).length,
    [drafts, activeCaptureId],
  );

  const activeWorkItems = useMemo<ActiveWorkItem[]>(() => {
    if (activeCapture) {
      const { status, seconds } = activeCapture.snapshot;
      const openCapture = () => router.navigate({
        pathname: '/capture/new',
        params: { draftId: activeCapture.snapshot.encounterId },
      });
      if (status === 'processing') {
        return [{ key: 'processing', icon: Clock, label: 'Preparing your transcript', onPress: openCapture }];
      }
      const label = status === 'paused'
        ? `Recording paused · ${formatDuration(seconds)}`
        : `Recording in progress · ${formatDuration(seconds)}`;
      return [{ key: 'recording', icon: Microphone, label, onPress: openCapture }];
    }

    const items: ActiveWorkItem[] = [];
    if (pendingReviewCount > 0 || draftCount > 0) {
      const parts: string[] = [];
      if (pendingReviewCount > 0) {
        parts.push(pendingReviewCount === 1 ? '1 ready to review' : `${pendingReviewCount} ready to review`);
      }
      if (draftCount > 0) {
        parts.push(draftCount === 1 ? '1 draft to finish' : `${draftCount} drafts to finish`);
      }
      items.push({
        key: 'capture',
        icon: Notebook,
        label: parts.join(' · '),
        onPress: () => router.push('/capture'),
      });
    }
    return items;
  }, [activeCapture, pendingReviewCount, draftCount]);

  const sortedConnections = useMemo(
    () => sortConnections(connections, 'date'),
    [connections],
  );
  const recentPeople = useMemo(() => sortedConnections.slice(0, 3), [sortedConnections]);

  const hasCard = cards.length > 0;
  // AppTabBar floats as an absolute overlay now, so this screen's root View
  // spans the full window height — the FAB must clear the pill itself.
  const fabBottomOffset = tabBarHeight + spacing.x3;
  const fabClearance = fabBottomOffset + 56 + spacing.x4;

  return (
    <View style={styles.safe}>
      <View style={[styles.fixedBar, { paddingTop: insets.top + spacing.x2 }]}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>
            {greetingName ? `${timeGreeting()}, ${greetingName}` : timeGreeting()}
          </Text>
          <Text style={styles.greetingSubtitle} numberOfLines={1}>Here’s a quick look at what’s ahead.</Text>
          <OfflineBanner style={styles.offlineBanner} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'}
          hitSlop={4}
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [styles.bellButton, pressed && styles.bellButtonPressed]}>
          <Bell size={21} color={colors.ink} weight="bold" />
          {unreadNotifications ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{Math.min(unreadNotifications, 9)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: fabClearance }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {loading && !hasLoadedOnce ? (
          <HomeSkeleton />
        ) : (
          <>
            {loadError ? (
              <MiniPromptCard
                icon={<ListChecks size={18} color={colors.ink} weight="bold" />}
                title="Could not load Home"
                copy={loadError}
                onPress={() => void load()}
              />
            ) : null}

            {session ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${attention.headline}. Open follow-ups`}
                onPress={() => router.push('/settings/follow-ups')}
                style={({ pressed }) => [styles.attentionCard, pressed && styles.attentionCardPressed]}>
                {attention.hasData ? (
                  <View style={styles.attentionRingWrap}>
                    <ProgressRing
                      size={54}
                      strokeWidth={4}
                      progress={attention.rate}
                      trackColor={colors.surfaceMuted}
                      progressColor={colors.accent}>
                      <ListChecks size={20} color={colors.ink} weight="bold" />
                    </ProgressRing>
                    {attention.urgent ? <View style={styles.attentionUrgentDot} /> : null}
                  </View>
                ) : (
                  <View style={[styles.attentionIcon]}>
                    <ListChecks size={20} color={colors.ink} weight="bold" />
                  </View>
                )}
                <View style={styles.attentionCopy}>
                  <Text style={styles.attentionHeadline}>{attention.headline}</Text>
                  {attention.hasData ? (
                    <Text style={styles.attentionSubline}>
                      <Text style={styles.attentionStat}>{attention.rate}%</Text> kept · {attention.completed} of {attention.total} completed
                    </Text>
                  ) : (
                    <Text style={styles.attentionSubline}>Your commitments will appear here.</Text>
                  )}
                </View>
                <CaretRight size={14} color={colors.muted} weight="bold" />
              </Pressable>
            ) : null}

            {activeWorkItems.length ? (
              <View style={styles.activeWork}>
                {activeWorkItems.map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    onPress={item.onPress}
                    style={({ pressed }) => [styles.activeWorkRow, pressed && styles.activeWorkRowPressed]}>
                    <View style={styles.activeWorkIcon}>
                      <item.icon size={17} color={colors.ink} weight="bold" />
                    </View>
                    <Text style={styles.activeWorkLabel} numberOfLines={1}>{item.label}</Text>
                    <CaretRight size={14} color={colors.muted} weight="bold" />
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Recent connections</Text>
                {session && sortedConnections.length > 3 ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push('/connections')}>
                    <Text style={styles.viewAll}>View all</Text>
                  </Pressable>
                ) : null}
              </View>
              {session && recentPeople.length ? (
                <View style={styles.peopleList}>
                  {recentPeople.map((connection) => (
                    <RecentPersonRow key={connection.id} connection={connection} />
                  ))}
                </View>
              ) : session ? (
                <MiniPromptCard
                  icon={<UsersThree size={18} color={colors.ink} weight="fill" />}
                  title="No recent connections yet."
                  copy="Scan a card or add someone after your next conversation."
                  onPress={() => router.push('/scanner')}
                />
              ) : (
                <MiniPromptCard
                  icon={<UsersThree size={18} color={colors.ink} weight="fill" />}
                  title="Sign in to see recent connections"
                  copy="People you scan or add will show up here."
                  onPress={() => router.push('/auth')}
                />
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My primary card</Text>
              {!cardLoading && hasCard ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/card/${card.id}`)}
                  style={({ pressed }) => [styles.myCardRow, pressed && styles.myCardRowPressed]}>
                  {card.photo ? (
                    <Image source={card.photo} style={styles.myCardAvatar} contentFit="cover" alt="" />
                  ) : (
                    <View style={styles.myCardAvatarFallback}>
                      <IdentificationCard size={20} color={colors.ink} weight="bold" />
                    </View>
                  )}
                  <View style={styles.myCardCopy}>
                    <Text style={styles.myCardLabel} numberOfLines={1}>{card.label || 'My card'}</Text>
                    <Text style={styles.myCardMeta} numberOfLines={1}>
                      {[card.name, [card.role, card.company].filter(Boolean).join(' · ')].filter(Boolean).join(' · ') || 'Add your details'}
                    </Text>
                  </View>
                  <Text style={styles.myCardAction}>Open card</Text>
                  <CaretRight size={14} color={colors.muted} weight="bold" />
                </Pressable>
              ) : !cardLoading ? (
                <MiniPromptCard
                  icon={<IdentificationCard size={18} color={colors.ink} weight="bold" />}
                  title="Create your first card"
                  copy="Publish a card so people can save your details instantly."
                  onPress={() => router.push(`/edit-card?id=${card.id}`)}
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick actions"
        onPress={() => setFabOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: fabBottomOffset },
          pressed && styles.fabPressed,
        ]}>
        <Plus size={24} color={colors.white} weight="bold" />
      </Pressable>

      <BottomSheet visible={fabOpen} title="Quick actions" onClose={() => setFabOpen(false)}>
        <View style={styles.fabOptions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void startCaptureNow()}
            style={({ pressed }) => [styles.fabOption, pressed && styles.fabOptionPressed]}>
            <View style={styles.fabOptionIcon}>
              <Microphone size={20} color={colors.ink} weight="bold" />
            </View>
            <Text style={styles.fabOptionLabel}>Capture context</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFabOpen(false);
              if (card.status === 'published') {
                router.navigate(`/share-card?id=${card.id}`);
              } else {
                router.navigate(`/edit-card?id=${card.id}`);
              }
            }}
            style={({ pressed }) => [styles.fabOption, pressed && styles.fabOptionPressed]}>
            <View style={styles.fabOptionIcon}>
              <QrCode size={20} color={colors.ink} weight="bold" />
            </View>
            <Text style={styles.fabOptionLabel}>Share my card</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFabOpen(false);
              router.push('/quick-follow-up');
            }}
            style={({ pressed }) => [styles.fabOption, pressed && styles.fabOptionPressed]}>
            <View style={styles.fabOptionIcon}>
              <ListChecks size={20} color={colors.ink} weight="bold" />
            </View>
            <Text style={styles.fabOptionLabel}>Quick follow-up</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFabOpen(false);
              router.push('/scanner');
            }}
            style={({ pressed }) => [styles.fabOption, pressed && styles.fabOptionPressed]}>
            <View style={styles.fabOptionIcon}>
              <Scan size={20} color={colors.ink} weight="bold" />
            </View>
            <Text style={styles.fabOptionLabel}>Quick scan</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

function isRecentConnection(connectedAt?: string) {
  if (!connectedAt) return false;
  const connected = new Date(connectedAt).getTime();
  if (Number.isNaN(connected)) return false;
  return Date.now() - connected < 48 * 60 * 60 * 1000;
}

function RecentPersonRow({ connection }: { connection: ConnectionItem }) {
  const avatar = connection.photoUrl || connectionAvatarUrl(connection);
  const isNew = isRecentConnection(connection.connectedAt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/connections/${encodeURIComponent(connection.id)}`)}
      style={({ pressed }) => [styles.personRow, pressed && styles.personRowPressed]}>
      <Image source={avatar} style={styles.personAvatar} contentFit="cover" alt={`${connection.name} profile photo`} />
      <View style={styles.personCopy}>
        <Text style={styles.personName} numberOfLines={1}>{connection.name}</Text>
        <Text style={styles.personSubtitle} numberOfLines={1}>
          {connection.subtitle}{connection.connectedAt ? ` · ${formatRelativeTime(connection.connectedAt)}` : ''}
        </Text>
      </View>
      {isNew ? (
        <View style={styles.personTag}>
          <Text style={styles.personTagText}>New</Text>
        </View>
      ) : null}
      <CaretRight size={14} color={colors.muted} weight="bold" />
    </Pressable>
  );
}

function HomeSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <Skeleton style={styles.skeletonAttention} />
      <View style={styles.skeletonRow}>
        <Skeleton style={styles.skeletonButton} />
        <Skeleton style={styles.skeletonButton} />
      </View>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.skeletonPersonRow}>
          <SkeletonCircle size={40} />
          <View style={{ flex: 1, gap: spacing.x1 }}>
            <SkeletonLine width="60%" />
            <SkeletonLine width="40%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fixedBar: {
    paddingHorizontal: spacing.x5,
    paddingBottom: spacing.x3,
    backgroundColor: colors.canvas,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.x3,
  },
  greetingBlock: { flex: 1, minWidth: 0, gap: 2 },
  offlineBanner: { marginTop: spacing.x2, alignSelf: 'stretch' },
  greetingTitle: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  greetingSubtitle: { color: colors.muted, fontSize: 13 },
  bellButton: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bellButtonPressed: { backgroundColor: colors.surfaceMuted },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  bellBadgeText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.x5,
    paddingTop: spacing.x4,
    paddingBottom: spacing.x6,
    gap: spacing.x4,
  },
  attentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x4,
    paddingVertical: spacing.x5,
    paddingLeft: spacing.x5,
    paddingRight: spacing.x3,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  attentionCardPressed: { opacity: 0.92 },
  attentionRingWrap: { width: 54, height: 54 },
  attentionUrgentDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: radius.round,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  attentionIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  attentionCopy: { flex: 1, gap: 4 },
  attentionHeadline: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  attentionSubline: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  attentionStat: { color: colors.ink, fontWeight: '800' },
  activeWork: { gap: spacing.x2 },
  activeWorkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x3,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activeWorkRowPressed: { opacity: 0.9 },
  activeWorkIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  activeWorkLabel: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  section: { gap: spacing.x3 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  viewAll: { color: colors.link, fontSize: 12, fontWeight: '800' },
  peopleList: { gap: spacing.x2 },
  personRow: {
    minHeight: 60,
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
  personRowPressed: { opacity: 0.9 },
  personAvatar: { width: 40, height: 40, borderRadius: radius.round, backgroundColor: colors.surfaceMuted },
  personCopy: { flex: 1, minWidth: 0, gap: 1 },
  personName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  personSubtitle: { color: colors.muted, fontSize: 11.5, lineHeight: 15 },
  personTag: {
    paddingHorizontal: spacing.x2,
    paddingVertical: 3,
    borderRadius: radius.round,
    backgroundColor: colors.accent,
  },
  personTagText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  myCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x3,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  myCardRowPressed: { opacity: 0.9 },
  myCardAvatar: { width: 44, height: 44, borderRadius: radius.round, backgroundColor: colors.surfaceMuted },
  myCardAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  myCardCopy: { flex: 1, minWidth: 0, gap: 1 },
  myCardLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  myCardMeta: { color: colors.muted, fontSize: 12 },
  myCardAction: { color: colors.link, fontSize: 12, fontWeight: '800' },
  skeletonWrap: { gap: spacing.x4 },
  skeletonAttention: { height: 72, borderRadius: radius.medium },
  skeletonRow: { flexDirection: 'row', gap: spacing.x3 },
  skeletonButton: { flex: 1, height: 48, borderRadius: radius.small },
  skeletonPersonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  fab: {
    position: 'absolute',
    right: spacing.x5,
    width: 56,
    height: 56,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: { opacity: 0.88 },
  fabOptions: { gap: spacing.x2 },
  fabOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x3,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  fabOptionPressed: { opacity: 0.9 },
  fabOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  fabOptionLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
});
