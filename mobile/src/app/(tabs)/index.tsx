import { router, useFocusEffect } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { FollowUpCell } from '@/components/follow-up-cell';
import { FollowUpMissingSheet } from '@/components/follow-up-missing-sheet';
import { FollowUpsSheet } from '@/components/follow-ups-sheet';
import { Body, Eyebrow, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { fetchFollowUps, type FollowUpItem } from '@/features/follow-ups/follow-up-api';
import { useFollowUpActions } from '@/features/follow-ups/use-follow-up-actions';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

const STEPS = [
  {
    num: '01',
    title: 'Share or scan',
    copy: 'Exchange details without requiring another app.',
    route: '/share-card' as const,
  },
  {
    num: '02',
    title: 'Capture context',
    copy: 'Record what mattered while the meeting is fresh.',
    route: '/capture' as const,
  },
  {
    num: '03',
    title: 'Connections',
    copy: 'People who shared with you, cards you saved, and contacts you added.',
    route: '/connections' as const,
  },
];

export default function HomeScreen() {
  const insets = useAppInsets();
  const { session } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const loadFollowUps = useCallback(async () => {
    if (!session?.access_token) {
      setFollowUps([]);
      return;
    }
    setLoadingFollowUps(true);
    try {
      setFollowUps(await fetchFollowUps(session.access_token));
    } catch {
      setFollowUps([]);
    } finally {
      setLoadingFollowUps(false);
    }
  }, [session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      void loadFollowUps();
    }, [loadFollowUps]),
  );

  const preview = useMemo(() => followUps.slice(0, 3), [followUps]);

  return (
    <View style={styles.safe}>
      <View style={[styles.fixedBar, { paddingTop: insets.top + spacing.x2 }]}>
        <View style={styles.brandRow}>
          <BrandMark size={32} />
          <Eyebrow>AfterMeet</Eyebrow>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Title style={styles.title}>Share. Capture. Connect.</Title>
        <Body style={styles.lead}>
          Share your card, capture the meeting, and keep track of the people you meet.
        </Body>

        {session ? (
          <View style={styles.followUpsSection}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Follow-ups</Text>
              {followUps.length > 3 ? (
                <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)}>
                  <Text style={styles.viewAll}>View all</Text>
                </Pressable>
              ) : null}
            </View>

            {loadingFollowUps ? (
              <ActivityIndicator color={colors.ink} />
            ) : preview.length ? (
              <View style={styles.followUpList}>
                {preview.map((item) => (
                  <FollowUpCell
                    key={`${item.encounterId}-${item.actionId}`}
                    item={item}
                    onPress={() => runFollowUp(item)}
                    onComplete={() => void markComplete(item, loadFollowUps)}
                    completing={completingId === `${item.encounterId}-${item.actionId}`}
                  />
                ))}
              </View>
            ) : (
              <Body style={styles.emptyFollowUps}>
                Open actions from your captures will show up here after you save a follow-up.
              </Body>
            )}
          </View>
        ) : null}

        <View style={styles.steps}>
          {STEPS.map((step) => (
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

      <FollowUpsSheet
        visible={sheetOpen}
        items={followUps}
        onClose={() => setSheetOpen(false)}
        onPressItem={(item) => runFollowUp(item)}
        onCompleteItem={(item) => void markComplete(item, loadFollowUps)}
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
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.x5,
    paddingTop: spacing.x4,
    paddingBottom: spacing.x3,
    gap: spacing.x4,
  },
  title: { fontSize: 34, lineHeight: 36 },
  lead: { marginTop: -spacing.x2 },
  followUpsSection: { gap: spacing.x3 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  viewAll: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  followUpList: { gap: spacing.x3 },
  emptyFollowUps: { color: colors.muted, fontSize: 14, lineHeight: 20 },
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
