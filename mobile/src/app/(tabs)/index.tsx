import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Body, Eyebrow, Screen, Title } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
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
];

export default function HomeScreen() {
  const { card } = useCard();

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <BrandMark size={32} />
          <Eyebrow>AfterMeet</Eyebrow>
        </View>
        <Title style={styles.title}>Share. Capture. Done.</Title>
        <Body>The mobile app stays simple — share your card, then capture the meeting while it is fresh.</Body>
      </View>

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

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/share-card')}
        style={styles.quickShare}>
        <Text style={styles.quickEyebrow}>Primary card</Text>
        <Text style={styles.quickTitle}>{card.label || card.name}</Text>
        <Text style={styles.quickCopy}>{card.role}{card.company ? ` · ${card.company}` : ''}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.x2, gap: spacing.x3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  title: { fontSize: 34, lineHeight: 36 },
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
  quickShare: {
    padding: spacing.x5,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  quickTitle: { marginTop: 6, color: colors.ink, fontSize: 20, fontWeight: '800' },
  quickCopy: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 18 },
});
