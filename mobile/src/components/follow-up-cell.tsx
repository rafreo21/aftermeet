import { Check, Phone, EnvelopeSimple, LinkedinLogo, CalendarBlank, PaperPlaneTilt, WhatsappLogo } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FollowUpItem } from '@/features/follow-ups/follow-up-api';
import { channelLabel } from '@/features/follow-ups/action-links';
import { dueTone, formatDueLabel } from '@/lib/due-date';
import { colors, radius, spacing } from '@/theme/tokens';

type FollowUpCellProps = {
  item: FollowUpItem;
  onPress: () => void;
  onComplete: () => void;
  completing?: boolean;
};

function channelIcon(channel: FollowUpItem['channel']): ReactNode {
  const props = { size: 18, color: colors.ink, weight: 'bold' as const };
  switch (channel) {
    case 'call': return <Phone {...props} />;
    case 'linkedin': return <LinkedinLogo {...props} />;
    case 'email': return <EnvelopeSimple {...props} />;
    case 'meeting': return <CalendarBlank {...props} />;
    case 'whatsapp': return <WhatsappLogo {...props} />;
    case 'send': return <PaperPlaneTilt {...props} />;
    default: return <PaperPlaneTilt {...props} />;
  }
}

export function FollowUpCell({ item, onPress, onComplete, completing }: FollowUpCellProps) {
  const dueLabel = formatDueLabel(item.dueAt);
  const tone = dueTone(item.dueAt);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <View style={styles.iconWrap}>{channelIcon(item.channel)}</View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {channelLabel(item.channel)} · {item.personName.trim() || 'Contact'}
          </Text>
          {item.title ? <Text style={styles.subtitle} numberOfLines={2}>{item.title}</Text> : null}
        </View>
        {dueLabel ? (
          <Text style={[
            styles.due,
            tone === 'overdue' && styles.dueOverdue,
            tone === 'today' && styles.dueToday,
          ]}>
            {dueLabel}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mark follow-up done"
        disabled={completing}
        onPress={onComplete}
        style={({ pressed }) => [styles.check, pressed && styles.pressed]}>
        <Check size={18} color={colors.muted} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x4,
  },
  pressed: { opacity: 0.82 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  due: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  dueOverdue: { color: colors.danger },
  dueToday: { color: colors.warning },
  check: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    backgroundColor: colors.canvas,
  },
});
