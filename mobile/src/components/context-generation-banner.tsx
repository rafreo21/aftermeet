import * as Haptics from 'expo-haptics';
import { CheckCircle, Sparkle } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

export type ContextGenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

const PHASES = [
  'Reading your transcript',
  'Detecting who you met',
  'Extracting private notes',
  'Building shared summary',
  'Drafting follow-up actions',
];

const ESTIMATE_SECONDS = 45;

type ContextGenerationBannerProps = {
  status: ContextGenerationStatus;
  startedAt?: number | null;
  errorMessage?: string;
  onDismissReady?: () => void;
};

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
}

export function ContextGenerationBanner({
  status,
  startedAt,
  errorMessage,
  onDismissReady,
}: ContextGenerationBannerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (status !== 'generating' || !startedAt) {
      setElapsed(0);
      setPhaseIndex(0);
      return;
    }

    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, status]);

  useEffect(() => {
    if (status !== 'generating') return;
    const timer = setInterval(() => {
      setPhaseIndex((current) => (current + 1) % PHASES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === 'ready') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [status]);

  const remainingHint = useMemo(() => {
    if (status !== 'generating') return '';
    const remaining = Math.max(0, ESTIMATE_SECONDS - elapsed);
    if (remaining <= 5) return 'Almost ready…';
    return `About ${remaining}s remaining`;
  }, [elapsed, status]);

  if (status === 'idle') return null;

  if (status === 'ready') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onDismissReady}
        style={styles.readyCard}>
        <CheckCircle size={22} color={colors.ink} weight="fill" />
        <View style={styles.copy}>
          <Text style={styles.readyTitle}>Meeting context is ready</Text>
          <Text style={styles.readyBody}>
            Private notes, shared summary, and follow-up draft are ready to review.
          </Text>
        </View>
      </Pressable>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>Could not generate context</Text>
        <Text style={styles.errorBody}>{errorMessage || 'Try again in a moment.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.generatingCard}>
      <View style={styles.generatingHead}>
        <ActivityIndicator color={colors.ink} />
        <View style={styles.copy}>
          <Text style={styles.generatingTitle}>Generating meeting context</Text>
          <Text style={styles.generatingPhase}>{PHASES[phaseIndex]}</Text>
        </View>
        <Sparkle size={18} color={colors.ink} weight="fill" />
      </View>
      <Text style={styles.generatingMeta}>
        {formatElapsed(elapsed)} elapsed · Usually 20–60 seconds · {remainingHint}
      </Text>
      <Text style={styles.generatingHint}>
        You can add their details on the next screen — we will notify you when the draft is ready.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  generatingCard: {
    gap: spacing.x3,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  generatingHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
  },
  copy: { flex: 1, gap: 4 },
  generatingTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  generatingPhase: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  generatingMeta: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  generatingHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  readyCard: {
    flexDirection: 'row',
    gap: spacing.x3,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: '#EAF6E4',
    borderWidth: 1,
    borderColor: '#CFE8C0',
  },
  readyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  readyBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  errorCard: {
    gap: spacing.x2,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#F3CACA',
  },
  errorTitle: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  errorBody: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
