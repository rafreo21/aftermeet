import type { CaptureWizardDraft } from '@/features/encounters/capture-draft';
import { Body, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { Sparkle } from 'phosphor-react-native';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

type CaptureContextStepProps = {
  draft: CaptureWizardDraft;
  onDraftChange: (changes: Partial<CaptureWizardDraft>) => void;
  refreshing: boolean;
  isGenerating: boolean;
  generationError?: string;
  onRefresh: () => void;
  uncertainFields: string[];
};

export function CaptureContextStep({
  draft,
  onDraftChange,
  refreshing,
  isGenerating,
  generationError,
  onRefresh,
  uncertainFields,
}: CaptureContextStepProps) {
  const waitingForDraft = isGenerating && !draft.title.trim() && !draft.sharedSummary.trim();
  const people = draft.people ?? [];

  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Sparkle size={18} color={colors.ink} weight="fill" />
        <Text style={styles.blockTitle}>Meeting context</Text>
      </View>
      <Body>
        We draft a meeting title and share summary from your transcript. Edit either field before you continue.
      </Body>

      {waitingForDraft ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.ink} size="small" />
          <Text style={styles.statusCopy}>Drafting title and summary…</Text>
        </View>
      ) : null}

      {generationError && !draft.title.trim() && !draft.sharedSummary.trim() ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not draft context</Text>
          <Text style={styles.errorBody}>{generationError}</Text>
        </View>
      ) : null}

      {uncertainFields.length > 0 ? (
        <Text style={styles.uncertain}>Double-check: {uncertainFields.join(', ')}</Text>
      ) : null}

      {people.length ? (
        <View style={styles.peopleWrap}>
          <Text style={styles.label}>In this meeting</Text>
          <View style={styles.peopleRow}>
            {people.map((person) => (
              <View key={person.id} style={styles.personChip}>
                <Text style={styles.personChipText}>{person.name.trim() || 'Guest'}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Meeting title</Text>
      <TextInput
        value={draft.title}
        onChangeText={(value) => onDraftChange({ title: value })}
        placeholder="Product sync with design and eng"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Text style={styles.label}>Share summary</Text>
      <Text style={styles.fieldHint}>
        A clear recap of what was discussed — safe to send to everyone in the room.
      </Text>
      <TextInput
        value={draft.sharedSummary}
        onChangeText={(value) => onDraftChange({ sharedSummary: value })}
        placeholder="What you discussed, decided, and who owns what next…"
        placeholderTextColor={colors.muted}
        multiline
        scrollEnabled
        style={[styles.input, styles.summaryField]}
      />
      <Button variant="secondary" loading={refreshing} onPress={onRefresh}>
        Refresh suggestions
      </Button>
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
  peopleWrap: { gap: spacing.x2 },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  personChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  personChipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
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
  summaryField: { minHeight: 180, maxHeight: 260, paddingTop: spacing.x3, textAlignVertical: 'top' },
  uncertain: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  statusCopy: { color: colors.muted, fontSize: 13 },
  errorBox: {
    gap: spacing.x1,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#F3CACA',
  },
  errorTitle: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  errorBody: { color: colors.danger, fontSize: 12, lineHeight: 18 },
});
