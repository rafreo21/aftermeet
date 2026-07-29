import { DUE_PRESETS, dueDateFromPreset, inferDuePreset, type DuePreset } from '@/lib/due-date';
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
  skip: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.x1,
  },
  skipActive: {},
  skipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  skipTextActive: { color: colors.ink },
});
