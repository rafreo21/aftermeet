import {
  DUE_PRESETS,
  dueDateFromPreset,
  formatCustomDueDate,
  inferDuePreset,
  shiftDueDate,
  type DuePreset,
} from '@/lib/due-date';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

type FollowUpDuePickerProps = {
  dueAt: string;
  onChange: (dueAt: string) => void;
};

export function FollowUpDuePicker({ dueAt, onChange }: FollowUpDuePickerProps) {
  const activePreset = inferDuePreset(dueAt);

  function selectPreset(preset: DuePreset) {
    if (preset === 'none') {
      onChange('');
      return;
    }
    if (preset === 'custom') {
      onChange(dueAt.trim() || dueDateFromPreset('in_3_days'));
      return;
    }
    onChange(dueDateFromPreset(preset));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>When should you do this?</Text>
      <View style={styles.row}>
        {DUE_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            onPress={() => selectPreset(preset.id)}
            style={[styles.chip, activePreset === preset.id && styles.chipActive]}>
            <Text style={[styles.chipText, activePreset === preset.id && styles.chipTextActive]}>
              {preset.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {activePreset === 'custom' ? (
        <View style={styles.customRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => onChange(shiftDueDate(dueAt, -1))}
            style={styles.stepButton}>
            <CaretLeft size={16} color={colors.ink} weight="bold" />
          </Pressable>
          <Text style={styles.customDate}>{formatCustomDueDate(dueAt)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            onPress={() => onChange(shiftDueDate(dueAt, 1))}
            style={styles.stepButton}>
            <CaretRight size={16} color={colors.ink} weight="bold" />
          </Pressable>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => selectPreset('none')}
        style={[styles.skip, activePreset === 'none' && styles.skipActive]}>
        <Text style={[styles.skipText, activePreset === 'none' && styles.skipTextActive]}>
          No rush. Skip
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.x3 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  chip: {
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x2,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  customDate: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  skip: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.x1,
  },
  skipActive: {},
  skipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  skipTextActive: { color: colors.ink },
});
