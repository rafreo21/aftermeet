import { CaretRight, Check } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { channelLabel } from '@/features/follow-ups/action-links';
import { displayFollowUpTitle, type FollowUpChannel } from '@/features/follow-ups/follow-up-channels';
import type { FollowUpGroup } from '@/features/follow-ups/follow-up-groups';
import { dueTone, formatDueLabel } from '@/lib/due-date';
import { colors, radius, spacing } from '@/theme/tokens';

type GroupedFollowUpCellProps = {
  group: FollowUpGroup;
  onPress: () => void;
  onComplete: () => void;
  completing?: boolean;
};

function channelSummary(items: FollowUpGroup['items']) {
  return items.map((item) => channelLabel(item.channel)).join(' · ');
}

export function GroupedFollowUpCell({
  group,
  onPress,
  onComplete,
  completing,
}: GroupedFollowUpCellProps) {
  const dueLabel = formatDueLabel(group.dueAt);
  const tone = dueTone(group.dueAt);
  const subtitle = group.items.length > 1
    ? channelSummary(group.items)
    : displayFollowUpTitle(
      group.items[0]?.title || '',
      (group.items[0]?.channel || 'email') as FollowUpChannel,
    );

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {group.personName.trim() || 'Contact'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          {group.encounterTitle ? (
            <Text style={styles.meta} numberOfLines={1}>{group.encounterTitle}</Text>
          ) : null}
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
        {group.items.length > 1 ? (
          <CaretRight size={16} color={colors.muted} weight="bold" />
        ) : null}
      </Pressable>
      {group.items.length === 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark follow-up done"
          disabled={completing}
          onPress={onComplete}
          style={({ pressed }) => [styles.check, pressed && styles.pressed]}>
          <Check size={18} color={colors.muted} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function GroupedFollowUpActions({
  group,
  onPressItem,
  onCompleteItem,
  completingId,
}: {
  group: FollowUpGroup;
  onPressItem: (actionId: string) => void;
  onCompleteItem: (actionId: string) => void;
  completingId?: string | null;
}) {
  return (
    <View style={actionStyles.list}>
      {group.items.map((item) => (
        <View key={item.actionId} style={actionStyles.row}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onPressItem(item.actionId)}
            style={({ pressed }) => [actionStyles.main, pressed && actionStyles.pressed]}>
            <Text style={actionStyles.label}>{channelLabel(item.channel)}</Text>
            <Text style={actionStyles.copy}>
              {displayFollowUpTitle(item.title, item.channel as FollowUpChannel)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark follow-up done"
            disabled={completingId === `${item.encounterId}-${item.actionId}`}
            onPress={() => onCompleteItem(item.actionId)}
            style={({ pressed }) => [actionStyles.check, pressed && actionStyles.pressed]}>
            <Check size={18} color={colors.muted} weight="bold" />
          </Pressable>
        </View>
      ))}
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
  copy: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
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

const actionStyles = StyleSheet.create({
  list: { gap: spacing.x3 },
  row: {
    flexDirection: 'row',
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  main: { flex: 1, gap: 2, padding: spacing.x4 },
  pressed: { opacity: 0.82 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  check: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    backgroundColor: colors.canvas,
  },
});
