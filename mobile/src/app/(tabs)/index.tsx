import { router, useFocusEffect } from 'expo-router';
import { Bell, CaretRight, QrCode, Scan } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Body, Button, Eyebrow, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useCard } from '@/features/card/card-context';
import { fetchFollowUps, type FollowUpItem } from '@/features/follow-ups/follow-up-api';
import { summarizeFollowUpNudges } from '@/features/follow-ups/follow-up-nudges';
import { unreadNotificationCount } from '@/features/notifications/notification-service';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

const SECONDARY_STEPS = [
  {
    num: '02',
    title: 'Capture context',
    copy: 'Record what mattered while the meeting is fresh.',
    route: '/capture' as const,
  },
  {
    num: '03',
    title: 'Connections',
    copy: 'People who shared with you and cards you saved.',
    route: '/connections' as const,
  },
];

export default function HomeScreen() {
  const insets = useAppInsets();
  const { session } = useAuth();
  const { card } = useCard();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadFollowUps = useCallback(async () => {
    if (!session?.access_token) {
      setFollowUps([]);
      return;
    }
    try {
      setFollowUps(await fetchFollowUps(session.access_token));
    } catch {
      setFollowUps([]);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadFollowUps();
      void unreadNotificationCount().then(setUnreadNotifications);
    }, [loadFollowUps]),
  );

  const nudge = useMemo(() => summarizeFollowUpNudges(followUps), [followUps]);

  return (
    <View style={styles.safe}>
      <View style={[styles.fixedBar, { paddingTop: insets.top + spacing.x2 }]}>
        <View style={styles.brandRow}>
          <BrandMark size={32} />
          <Eyebrow>AfterMeet</Eyebrow>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'}
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Title style={styles.title}>Share your card in seconds</Title>
        <Body style={styles.lead}>
          Show your QR first. Capture the meeting and follow up after.
        </Body>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroNum}>01</Text>
          </View>
          <Text style={styles.heroTitle}>Show my QR</Text>
          <Text style={styles.heroCopy}>
            {card.status === 'published'
              ? `${card.name || 'Your card'} is ready to share.`
              : 'Publish your card to unlock your public QR link.'}
          </Text>
          <Button
            onPress={() => {
              if (card.status === 'published') {
                router.navigate(`/share-card?id=${card.id}`);
              } else {
                router.navigate(`/edit-card?id=${card.id}`);
              }
            }}>
            <QrCode size={18} color={colors.ink} weight="bold" />
            {card.status === 'published' ? 'Open Quick Share' : 'Publish card'}
          </Button>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan someone else's card"
            onPress={() => router.navigate('/scanner')}
            style={({ pressed }) => [styles.heroScanOverlay, pressed && styles.heroScanOverlayPressed]}>
            <Scan size={18} color={colors.accent} weight="bold" />
            <Text style={styles.heroScanOverlayText}>Scan someone else&apos;s card</Text>
          </Pressable>
        </View>

        {session && nudge ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/follow-ups')}
            style={({ pressed }) => [styles.nudgeCard, pressed && styles.nudgeCardPressed]}>
            <Text style={styles.nudgeTitle}>{nudge.headline}</Text>
            <Text style={styles.nudgeCopy}>{nudge.copy}</Text>
            <View style={styles.nudgeAction}>
              <Text style={styles.nudgeActionText}>Open follow-ups</Text>
              <CaretRight size={14} color={colors.ink} weight="bold" />
            </View>
          </Pressable>
        ) : null}

        <View style={styles.steps}>
          {SECONDARY_STEPS.map((step) => (
            <Pressable
              key={step.num}
              accessibilityRole="button"
              onPress={() => router.navigate(step.route)}
              style={({ pressed }) => [styles.stepCard, pressed && styles.stepCardPressed]}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{step.num}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepCopy}>{step.copy}</Text>
              <View style={styles.stepAction}>
                <Text style={styles.stepActionText}>Open</Text>
                <CaretRight size={14} color={colors.accent} weight="bold" />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fixedBar: {
    paddingHorizontal: spacing.x5,
    paddingBottom: spacing.x3,
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: spacing.x3,
    gap: spacing.x4,
  },
  title: { fontSize: 34, lineHeight: 36 },
  lead: { marginTop: -spacing.x2 },
  heroCard: {
    padding: spacing.x5,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
    gap: spacing.x2,
  },
  heroBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  heroNum: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800' },
  heroCopy: { color: '#C5D3BF', fontSize: 14, lineHeight: 20 },
  heroScanOverlay: {
    marginTop: spacing.x2,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x2,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroScanOverlayPressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
  heroScanOverlayText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  nudgeCard: {
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: '#fff4e8',
    borderWidth: 1,
    borderColor: '#f0c892',
    gap: spacing.x2,
  },
  nudgeCardPressed: { opacity: 0.92 },
  nudgeTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  nudgeCopy: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  nudgeAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nudgeActionText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  steps: { gap: spacing.x2 },
  stepCard: {
    padding: spacing.x5,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
    gap: spacing.x2,
  },
  stepCardPressed: { opacity: 0.92 },
  stepBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  stepNum: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  stepTitle: { color: colors.white, fontSize: 22, fontWeight: '800' },
  stepCopy: { color: '#C5D3BF', fontSize: 14, lineHeight: 20 },
  stepAction: { marginTop: spacing.x2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepActionText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
});
