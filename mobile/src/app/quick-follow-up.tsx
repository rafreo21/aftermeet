import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, PaperPlaneTilt } from 'phosphor-react-native';
import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, PageHeader } from '@/components/ui';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { OutcomeSuccessSheet } from '@/components/outcome-success-sheet';
import { useAuth } from '@/features/auth/auth-context';
import { buildEncounterPayload, saveEncounter } from '@/features/encounters/encounter-api';
import {
  FOLLOW_UP_CHANNELS,
  type FollowUpChannel,
} from '@/features/follow-ups/follow-up-channels';
import { FOLLOW_UP_TEMPLATES } from '@/features/follow-ups/follow-up-templates';
import { dueDateFromPreset, type DuePreset } from '@/lib/due-date';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

const DUE_OPTIONS: Array<{ id: Exclude<DuePreset, 'none' | 'custom'>; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'in_3_days', label: 'In 3 days' },
  { id: 'in_1_week', label: 'In 1 week' },
];

export default function QuickFollowUpScreen() {
  const params = useLocalSearchParams<{
    personName?: string;
    personEmail?: string;
    sourceId?: string;
    contactId?: string;
    exchangeId?: string;
  }>();
  const { session } = useAuth();
  const insets = useAppInsets();
  const [personName, setPersonName] = useState(params.personName?.trim() || '');
  const [personEmail, setPersonEmail] = useState(params.personEmail?.trim() || '');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<FollowUpChannel>('email');
  const [duePreset, setDuePreset] = useState<Exclude<DuePreset, 'none' | 'custom'>>('tomorrow');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [outcomeError, setOutcomeError] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);

  const selectedTemplateId = useMemo(() => (
    FOLLOW_UP_TEMPLATES.find((template) => (
      template.channel === channel && template.buildTitle(personName) === title
    ))?.id
  ), [channel, personName, title]);

  function applyTemplate(template: (typeof FOLLOW_UP_TEMPLATES)[number]) {
    setChannel(template.channel);
    setTitle(template.buildTitle(personName));
    const templateDue = template.dueAt();
    const matchingDue = DUE_OPTIONS.find((option) => dueDateFromPreset(option.id) === templateDue);
    if (matchingDue) setDuePreset(matchingDue.id);
  }

  async function submit() {
    const cleanName = personName.trim();
    const cleanTitle = title.trim();
    if (!session?.access_token) {
      setOutcomeError('Sign in before adding a follow-up.');
      return;
    }
    if (cleanName.length < 2) {
      setValidationError('Add the person this follow-up is for.');
      return;
    }
    if (cleanTitle.length < 2) {
      setValidationError('Describe the next step.');
      return;
    }

    setSaving(true);
    setValidationError('');
    setOutcomeError('');
    try {
      const encounter = buildEncounterPayload({
        transcript: '',
        title: `Follow-up with ${cleanName}`,
        personName: cleanName,
        personEmail: personEmail.trim(),
        people: [{
          id: params.sourceId || undefined,
          name: cleanName,
          email: personEmail.trim(),
          exchangeId: params.exchangeId || undefined,
        }],
        contactId: params.contactId || undefined,
        exchangeId: params.exchangeId || undefined,
        sharedSummary: '',
        privateNotes: '',
        followUp: cleanTitle,
        followUpChannels: [channel],
        dueAt: dueDateFromPreset(duePreset),
        consentConfirmed: false,
        status: 'reviewed',
        durationSeconds: 0,
        startedAt: new Date().toISOString(),
      });
      await saveEncounter(session.access_token, encounter);
      setSaving(false);
      setSuccessOpen(true);
    } catch (caught) {
      setOutcomeError(caught instanceof Error ? caught.message : 'Could not add this follow-up.');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.header}>
        <PageHeader
          eyebrow="Quick follow-up"
          title="What needs to happen next?"
          onBack={() => router.back()}
        />
        <Body>Create a reminder without recording a conversation. Nothing is sent automatically.</Body>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.x6 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}

        <View style={styles.form}>
          <Field label="Person" value={personName} onChangeText={setPersonName} placeholder="e.g. Sarah Chen" />
          <Field
            label="Email"
            hint="Optional"
            value={personEmail}
            onChangeText={setPersonEmail}
            placeholder="sarah@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.group}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Start with a template</Text>
              <Text style={styles.hint}>Optional</Text>
            </View>
            <View style={styles.chips}>
              {FOLLOW_UP_TEMPLATES.map((template) => (
                <ChoiceChip
                  key={template.id}
                  label={template.label}
                  selected={selectedTemplateId === template.id}
                  onPress={() => applyTemplate(template)}
                />
              ))}
            </View>
          </View>

          <Field
            label="Next step"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Send Sarah the revised product draft"
            multiline
          />

          <View style={styles.group}>
            <Text style={styles.label}>How will you follow up?</Text>
            <View style={styles.chips}>
              {FOLLOW_UP_CHANNELS.map((option) => (
                <ChoiceChip
                  key={option.id}
                  label={option.label}
                  selected={channel === option.id}
                  onPress={() => setChannel(option.id)}
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Due</Text>
            <View style={styles.chips}>
              {DUE_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.id}
                  label={option.label}
                  selected={duePreset === option.id}
                  onPress={() => setDuePreset(option.id)}
                />
              ))}
            </View>
          </View>

          <Button loading={saving} disabled={saving} onPress={() => void submit()}>
            <CheckCircle size={19} color={colors.ink} weight="bold" />
            Add follow-up
          </Button>
        </View>

        <View style={styles.note}>
          <PaperPlaneTilt size={17} color={colors.ink} weight="bold" />
          <Body style={styles.noteCopy}>AfterMeet will place this in Follow-ups and remind you until it is complete.</Body>
        </View>
      </ScrollView>
      <OutcomeErrorSheet
        visible={Boolean(outcomeError)}
        message={outcomeError}
        onClose={() => setOutcomeError('')}
      />
      <OutcomeSuccessSheet
        visible={successOpen}
        title="Follow-up added"
        message="It is now in Follow-ups and will stay there until you complete it."
        onClose={() => router.replace('/settings/follow-ups')}
      />
    </View>
  );
}

function Field({
  label,
  hint,
  multiline = false,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; hint?: string; multiline?: boolean }) {
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.x5, gap: spacing.x2 },
  scroll: { flex: 1, marginTop: spacing.x4 },
  content: { paddingHorizontal: spacing.x5, gap: spacing.x3 },
  form: {
    gap: spacing.x5,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
  },
  group: { gap: spacing.x2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.small,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 92, paddingTop: spacing.x4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.x3,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.accentPressed, backgroundColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  error: {
    padding: spacing.x3,
    borderRadius: radius.small,
    backgroundColor: '#FEE4E2',
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x2,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
  },
  noteCopy: { flex: 1, color: colors.inkSoft },
});
