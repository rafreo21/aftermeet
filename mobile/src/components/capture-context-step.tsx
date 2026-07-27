import type { CaptureWizardDraft } from '@/features/encounters/capture-draft';
import { Body, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { Sparkle } from 'phosphor-react-native';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

type CaptureContextStepProps = {
  draft: CaptureWizardDraft;
  onDraftChange: (changes: Partial<CaptureWizardDraft>) => void;
  refreshing: boolean;
  onRefresh: () => void;
  uncertainFields: string[];
};

export function CaptureContextStep({
  draft,
  onDraftChange,
  refreshing,
  onRefresh,
  uncertainFields,
}: CaptureContextStepProps) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Sparkle size={18} color={colors.ink} weight="fill" />
        <Text style={styles.blockTitle}>Meeting context</Text>
      </View>
      <Body>Edit anything before you save — private notes are yours alone; shared summary is safe to send.</Body>
      {uncertainFields.length > 0 ? (
        <Text style={styles.uncertain}>Double-check: {uncertainFields.join(', ')}</Text>
      ) : null}

      <Text style={styles.label}>Full name</Text>
      <TextInput
        value={draft.personName}
        onChangeText={(value) => onDraftChange({ personName: value })}
        placeholder="Who did you meet?"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Text style={styles.label}>Meeting title</Text>
      <TextInput
        value={draft.title}
        onChangeText={(value) => onDraftChange({ title: value })}
        placeholder="Coffee with Alex"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Text style={styles.label}>Private notes</Text>
      <Text style={styles.fieldHint}>What they said that matters — only you see this.</Text>
      <TextInput
        value={draft.privateNotes}
        onChangeText={(value) => onDraftChange({ privateNotes: value })}
        placeholder="Their priorities, constraints, commitments, and key quotes…"
        placeholderTextColor={colors.muted}
        multiline
        scrollEnabled
        style={[styles.input, styles.notesField]}
      />
      <Text style={styles.label}>Shared summary</Text>
      <Text style={styles.fieldHint}>What you both discussed — safe to share with them.</Text>
      <TextInput
        value={draft.sharedSummary}
        onChangeText={(value) => onDraftChange({ sharedSummary: value })}
        placeholder="Neutral summary of what you both agreed…"
        placeholderTextColor={colors.muted}
        multiline
        scrollEnabled
        style={[styles.input, styles.notesField]}
      />
      <Button variant="secondary" loading={refreshing} onPress={onRefresh}>
        Refresh suggestions
      </Button>
      {refreshing ? (
        <View style={styles.refreshRow}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.refreshCopy}>Updating context…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.x4,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  blockTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  fieldHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: 15,
  },
  notesField: { height: 140, maxHeight: 140, paddingTop: spacing.x3, textAlignVertical: 'top' },
  uncertain: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  refreshCopy: { color: colors.muted, fontSize: 12 },
});
