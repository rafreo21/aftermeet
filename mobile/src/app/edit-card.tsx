import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Image as ImageIcon, Palette, UserCircle, ListChecks } from 'phosphor-react-native';
import { useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CardPublishSheet } from '@/components/card-publish-sheet';
import { MethodListEditor } from '@/components/method-list-editor';
import { MobileCardPreview } from '@/components/mobile-card';
import { Body, Button, PageHeader } from '@/components/ui';
import { useAppInsets } from '@/lib/safe-area';
import { useCard } from '@/features/card/card-context';
import { CARD_THEMES, normalizeThemeColor, themeForegroundColor, themeMatches } from '@/features/card/theme-colors';
import type { MobileCard } from '@/features/card/types';
import { colors, radius, spacing } from '@/theme/tokens';

const STEPS = ['Design', 'Methods', 'Review'] as const;

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; icon?: ReactNode }>) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHead}>
        {icon ? <View style={styles.sectionIcon}>{icon}</View> : null}
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function StepIndicator({
  current,
  onStep,
}: {
  current: number;
  onStep: (index: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperTrack}>
        {STEPS.map((label, index) => {
          const active = index === current;
          const done = index < current;
          const leftLineActive = index > 0 && current >= index;
          const rightLineActive = index < STEPS.length - 1 && current > index;

          return (
            <View key={label} style={styles.stepperSegment}>
              <View style={[styles.stepperLine, index === 0 && styles.stepperLineHidden, leftLineActive && styles.stepperLineActive]} />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onStep(index)}
                style={[
                  styles.stepperDot,
                  active && styles.stepperDotActive,
                  done && styles.stepperDotDone,
                ]}>
                {done ? (
                  <Check size={14} color={colors.ink} weight="bold" />
                ) : (
                  <Text style={[styles.stepperNum, active && styles.stepperNumActive]}>{index + 1}</Text>
                )}
              </Pressable>
              <View style={[styles.stepperLine, index === STEPS.length - 1 && styles.stepperLineHidden, rightLineActive && styles.stepperLineActive]} />
            </View>
          );
        })}
      </View>

      <View style={styles.stepperLabels}>
        {STEPS.map((label, index) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={() => onStep(index)}
            style={styles.stepperLabelCell}>
            <Text style={[styles.stepperLabel, index === current && styles.stepperLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { card, getCardById, updateCardById, publishCard, publishing } = useCard();
  const source = useMemo(
    () => (id ? getCardById(id) : undefined) || card,
    [card, getCardById, id],
  );
  const [draft, setDraft] = useState<MobileCard>(source);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<'none' | 'success' | 'error'>('none');
  const [sheetMessage, setSheetMessage] = useState('');
  const [sheetDetail, setSheetDetail] = useState('');
  const insets = useAppInsets();

  useEffect(() => {
    if (!id) return;
    const next = getCardById(id);
    if (next) setDraft(next);
  }, [id]);

  async function persist(next: MobileCard) {
    const normalized = { ...next, theme: normalizeThemeColor(next.theme) };
    setDraft(normalized);
    if (normalized.id) await updateCardById(normalized.id, normalized);
  }

  function updateField<K extends keyof MobileCard>(key: K, value: MobileCard[K]) {
    void persist({ ...draft, [key]: value });
  }

  async function pickImage(key: 'photo' | 'companyLogo' | 'coverPhoto') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: key === 'coverPhoto' ? [16, 9] : [1, 1],
      quality: 0.82,
    });
    if (!result.canceled) updateField(key, result.assets[0].uri);
  }

  async function publish() {
    setSheet('none');
    try {
      await persist(draft);
      const result = await publishCard(draft.id, draft);
      if (result.ok) {
        setSheetMessage('Your card is live. Share the link, QR code, or open Card Tools for wallet and widgets.');
        setSheetDetail(result.publicUrl);
        setSheet('success');
        return;
      }
      setSheetMessage('We couldn’t publish this card. Check the details below and try again.');
      setSheetDetail(result.error);
      setSheet('error');
    } catch (error) {
      setSheetMessage('We couldn’t publish this card.');
      setSheetDetail(error instanceof Error ? error.message : 'Something went wrong.');
      setSheet('error');
    }
  }

  function closeSheet() {
    setSheet('none');
  }

  function finishAfterSuccess() {
    setSheet('none');
    router.back();
  }

  function openCardToolsAfterPublish() {
    setSheet('none');
    router.replace(`/card-tools?id=${draft.id}`);
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2, paddingBottom: insets.bottom }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <PageHeader
            eyebrow="Card editor"
            title={draft.label || 'Edit card'}
            titleStyle={styles.title}
          />
        </View>

        <View style={styles.stepperWrap}>
          <StepIndicator current={step} onStep={setStep} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <View style={styles.stepContent}>
              <SectionCard
                title="Photos"
                subtitle="Help people recognise you instantly"
                icon={<ImageIcon size={18} color={colors.ink} weight="bold" />}>
                <View style={styles.coverWrap}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void pickImage('coverPhoto')}
                    style={[styles.coverSlot, draft.coverPhoto && styles.coverSlotFilled]}>
                    {draft.coverPhoto ? (
                      <>
                        <Image alt="Cover photo preview" source={draft.coverPhoto} style={styles.coverImage} contentFit="cover" />
                        <View style={styles.imageOverlay}>
                          <Text style={styles.overlayText}>Change cover</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={28} color={colors.muted} weight="bold" />
                        <Text style={styles.coverLabel}>Add cover photo</Text>
                        <Text style={styles.coverHint}>Wide banner · 16:9</Text>
                      </>
                    )}
                  </Pressable>
                  {draft.coverPhoto ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateField('coverPhoto', '')}
                      style={styles.removeBadge}>
                      <Text style={styles.removeImage}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.photoRow}>
                  {([
                    ['companyLogo', 'Company logo'],
                    ['photo', 'Profile photo'],
                  ] as const).map(([key, label]) => (
                    <View key={key} style={styles.photoWrap}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void pickImage(key)}
                        style={[styles.photoSlot, draft[key] && styles.photoSlotFilled]}>
                        {draft[key] ? (
                          <>
                            <Image alt={`${label} preview`} source={draft[key]} style={styles.photoPreview} contentFit="cover" />
                            <View style={styles.imageOverlay}>
                              <Text style={styles.overlayTextSmall}>Change</Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <View style={styles.photoIconWrap}>
                              <ImageIcon size={22} color={colors.ink} weight="bold" />
                            </View>
                            <Text style={styles.photoHint}>Tap to upload</Text>
                          </>
                        )}
                      </Pressable>
                      <Text style={styles.photoLabel}>{label}</Text>
                      {draft[key] ? (
                        <Pressable accessibilityRole="button" onPress={() => updateField(key, '')}>
                          <Text style={styles.removeImage}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              </SectionCard>

              <SectionCard
                title="Your details"
                subtitle="What appears on the card"
                icon={<UserCircle size={18} color={colors.ink} weight="bold" />}>
                {([
                  ['label', 'Card label', 'e.g. Work card'],
                  ['name', 'Full name', 'Your name'],
                  ['role', 'Job title', 'What you do'],
                  ['company', 'Company', 'Where you work'],
                ] as const).map(([key, label, placeholder]) => (
                  <View key={key} style={styles.field}>
                    <Text style={styles.label}>{label}</Text>
                    <TextInput
                      value={draft[key]}
                      onChangeText={(value) => updateField(key, value)}
                      placeholder={placeholder}
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                    />
                  </View>
                ))}

                <View style={styles.field}>
                  <Text style={styles.label}>Short introduction</Text>
                  <TextInput
                    value={draft.bio}
                    onChangeText={(value) => updateField('bio', value.slice(0, 180))}
                    placeholder="A quick line about you"
                    placeholderTextColor={colors.muted}
                    multiline
                    style={[styles.input, styles.textarea]}
                  />
                  <Text style={styles.hint}>{draft.bio.length}/180</Text>
                </View>
              </SectionCard>

              <SectionCard
                title="Card colour"
                subtitle="Pick a theme that matches your brand"
                icon={<Palette size={18} color={colors.ink} weight="bold" />}>
                <View style={styles.swatches}>
                  {CARD_THEMES.map((theme) => (
                    <Pressable
                      accessibilityLabel={`Use ${theme}`}
                      key={theme}
                      onPress={() => updateField('theme', theme)}
                      style={[
                        styles.swatch,
                        { backgroundColor: theme },
                        themeMatches(draft.theme, theme) && styles.swatchSelected,
                      ]}>
                      {themeMatches(draft.theme, theme) ? (
                        <Check size={18} color={themeForegroundColor(theme)} weight="bold" />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </SectionCard>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stepContent}>
              <SectionCard
                title="Contact methods"
                subtitle="Add the ways people can reach you"
                icon={<ListChecks size={18} color={colors.ink} weight="bold" />}>
                <MethodListEditor
                  methods={draft.methods}
                  onChange={(methods) => void persist({ ...draft, methods })}
                />
              </SectionCard>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stepContent}>
              <View style={styles.reviewIntro}>
                <Text style={styles.reviewTitle}>Almost there</Text>
                <Body>Preview your card below, then publish when you are ready to share.</Body>
              </View>

              <View style={styles.previewWrap}>
                <MobileCardPreview card={draft} />
              </View>

              <View style={styles.reviewStats}>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{draft.methods.length}</Text>
                  <Text style={styles.statLabel}>Methods</Text>
                </View>
                <View style={styles.statPill}>
                  <View style={[styles.statSwatch, { backgroundColor: normalizeThemeColor(draft.theme) }]} />
                  <Text style={styles.statLabel}>Theme</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{draft.status === 'published' ? 'Live' : 'Draft'}</Text>
                  <Text style={styles.statLabel}>Status</Text>
                </View>
              </View>

              <View style={styles.reviewOption}>
                <View style={styles.reviewOptionCopy}>
                  <Text style={styles.reviewOptionTitle}>Company details</Text>
                  <Text style={styles.reviewOptionHint}>Show your logo, company name, and website on the card</Text>
                </View>
                <Switch
                  accessibilityLabel="Show company details"
                  value={draft.showCompanyDetails !== false}
                  onValueChange={(value) => updateField('showCompanyDetails', value)}
                  trackColor={{ false: colors.line, true: colors.accent }}
                  thumbColor={colors.surface}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          {step < 2 ? (
            <Button style={{ flex: 1 }} onPress={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button style={{ flex: 1 }} loading={publishing} onPress={() => void publish()}>
              Save and publish
            </Button>
          )}
        </View>
      </View>

      <CardPublishSheet
        visible={sheet === 'success'}
        variant="success"
        title="Card published"
        message={sheetMessage}
        detail={sheetDetail}
        primaryLabel="Done"
        secondaryLabel="Open card tools"
        onPrimary={finishAfterSuccess}
        onSecondary={openCardToolsAfterPublish}
        onClose={finishAfterSuccess}
      />

      <CardPublishSheet
        visible={sheet === 'error'}
        variant="error"
        title="Publish failed"
        message={sheetMessage}
        detail={sheetDetail}
        primaryLabel="Try again"
        secondaryLabel="Close"
        onPrimary={() => {
          closeSheet();
          void publish();
        }}
        onSecondary={closeSheet}
        onClose={closeSheet}
        loading={publishing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1 },
  header: { paddingHorizontal: spacing.x5 },
  title: { fontSize: 32, lineHeight: 34, letterSpacing: -1.1 },
  stepperWrap: {
    marginTop: spacing.x5,
    paddingHorizontal: spacing.x5,
  },
  stepper: { gap: spacing.x3 },
  stepperTrack: { flexDirection: 'row', alignItems: 'center' },
  stepperSegment: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepperLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.line,
    borderRadius: 1,
  },
  stepperLineHidden: { opacity: 0 },
  stepperLineActive: { backgroundColor: colors.accent },
  stepperDot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  stepperDotActive: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  stepperDotDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  stepperNum: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  stepperNumActive: { color: colors.white },
  stepperLabels: { flexDirection: 'row' },
  stepperLabelCell: { flex: 1, alignItems: 'center' },
  stepperLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  stepperLabelActive: { color: colors.ink },
  scroll: { flex: 1, marginTop: spacing.x4 },
  scrollContent: {
    paddingHorizontal: spacing.x5,
    paddingBottom: spacing.x6,
  },
  stepContent: { gap: spacing.x4 },
  sectionCard: {
    gap: spacing.x4,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  sectionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
  },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  coverWrap: { gap: spacing.x2 },
  coverSlot: {
    minHeight: 148,
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x2,
    borderRadius: radius.medium,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  coverSlotFilled: {
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  coverImage: {
    ...StyleSheet.absoluteFill,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 51, 0, 0.28)',
  },
  overlayText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  overlayTextSmall: { color: colors.white, fontSize: 12, fontWeight: '800' },
  coverLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  coverHint: { color: colors.muted, fontSize: 12 },
  removeBadge: { alignSelf: 'flex-start' },
  photoRow: { flexDirection: 'row', gap: spacing.x3 },
  photoWrap: { flex: 1, alignItems: 'center', gap: spacing.x2 },
  photoSlot: {
    width: '100%',
    aspectRatio: 1,
    padding: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x2,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  photoSlotFilled: {
    padding: 0,
  },
  photoPreview: {
    ...StyleSheet.absoluteFill,
  },
  photoIconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
  },
  photoLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  photoHint: { color: colors.muted, fontSize: 11 },
  removeImage: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  field: { gap: spacing.x2 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: 16,
  },
  textarea: { minHeight: 110, paddingTop: spacing.x4, textAlignVertical: 'top' },
  hint: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x3 },
  swatch: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.medium,
  },
  swatchSelected: { borderWidth: 2, borderColor: colors.ink },
  reviewIntro: { gap: spacing.x2, paddingHorizontal: spacing.x1 },
  reviewTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  previewWrap: {
    paddingVertical: spacing.x2,
  },
  reviewStats: {
    flexDirection: 'row',
    gap: spacing.x3,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.x2,
    paddingVertical: spacing.x4,
    paddingHorizontal: spacing.x2,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  statSwatch: {
    width: 28,
    height: 28,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  reviewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.x4,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reviewOptionCopy: { flex: 1, gap: 4 },
  reviewOptionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  reviewOptionHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    gap: spacing.x2,
    paddingHorizontal: spacing.x5,
    paddingTop: spacing.x3,
    paddingBottom: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.canvas,
  },
});
