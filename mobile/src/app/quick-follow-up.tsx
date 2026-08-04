import { router, useLocalSearchParams } from 'expo-router';
import {
  CaretDown,
  CaretRight,
  CaretUp,
  CheckCircle,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  QrCode,
  Scan,
  X,
} from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { BrandedQrCode } from '@/components/branded-qr-code';
import { FollowUpDuePicker } from '@/components/follow-up-due-picker';
import { Body, Button, PageHeader } from '@/components/ui';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { OutcomeSuccessSheet } from '@/components/outcome-success-sheet';
import { useAuth } from '@/features/auth/auth-context';
import { useCard } from '@/features/card/card-context';
import { fetchAllConnectionsMerged, filterConnections, type ConnectionItem } from '@/features/connections/connections-api';
import { buildEncounterPayload, fetchInboundExchanges, saveEncounter, type InboundExchange } from '@/features/encounters/encounter-api';
import { SELECTABLE_FOLLOW_UP_CHANNELS, type FollowUpChannel } from '@/features/follow-ups/follow-up-channels';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export default function QuickFollowUpScreen() {
  const params = useLocalSearchParams<{
    personName?: string;
    personEmail?: string;
    sourceId?: string;
    contactId?: string;
    exchangeId?: string;
  }>();
  const { session } = useAuth();
  const { card, publicUrl } = useCard();
  const insets = useAppInsets();

  const [personName, setPersonName] = useState(params.personName?.trim() || '');
  const [personEmail, setPersonEmail] = useState(params.personEmail?.trim() || '');

  const [addPersonSheetOpen, setAddPersonSheetOpen] = useState(false);
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [scansOpen, setScansOpen] = useState(false);
  const [exchanges, setExchanges] = useState<InboundExchange[]>([]);
  const [loadingExchanges, setLoadingExchanges] = useState(false);

  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<FollowUpChannel>('email');
  const [owner, setOwner] = useState<'me' | 'guest'>('me');
  const [dueAt, setDueAt] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [outcomeError, setOutcomeError] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (!addPersonSheetOpen || !session?.access_token) return;
    void fetchAllConnectionsMerged(session.access_token).then(setConnections).catch(() => setConnections([]));
  }, [addPersonSheetOpen, session?.access_token]);

  function pickConnection(connection: ConnectionItem) {
    setPersonName(connection.name);
    setPersonEmail(connection.email || '');
    setAddPersonSheetOpen(false);
    setPersonSearchQuery('');
  }

  function saveManualPerson() {
    const cleanName = manualName.trim();
    if (cleanName.length < 2) {
      setValidationError('Enter a name.');
      return;
    }
    setPersonName(cleanName);
    setPersonEmail(manualEmail.trim());
    setValidationError('');
    setManualOpen(false);
    setAddPersonSheetOpen(false);
  }

  async function openScans() {
    setScansOpen(true);
    if (!session?.access_token || exchanges.length) return;
    setLoadingExchanges(true);
    try {
      setExchanges(await fetchInboundExchanges(session.access_token));
    } catch {
      setExchanges([]);
    } finally {
      setLoadingExchanges(false);
    }
  }

  function pickExchange(exchange: InboundExchange) {
    setPersonName(exchange.visitor_name || 'Unknown visitor');
    setPersonEmail(exchange.visitor_email || '');
    setScansOpen(false);
    setAddPersonSheetOpen(false);
  }

  const pronoun = owner === 'me' ? 'you' : 'they';
  const searchResults = personSearchQuery.trim() ? filterConnections(connections, personSearchQuery) : [];

  async function submit() {
    const cleanName = personName.trim();
    if (!session?.access_token) {
      setOutcomeError('Sign in before adding a follow-up.');
      return;
    }
    if (cleanName.length < 2) {
      setValidationError('Add the person this follow-up is for.');
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
        manualFollowUps: [{
          title: title.trim(),
          channel,
          owner,
          targetPersonId: '',
          dueAt,
        }],
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => setAddPersonSheetOpen(true)}
          style={styles.personTrigger}>
          <View style={styles.personTriggerCopy}>
            <Text style={styles.label}>Person</Text>
            {personName.trim() ? (
              <>
                <Text style={styles.personTriggerName}>{personName}</Text>
                {personEmail.trim() ? <Text style={styles.linkHint}>{personEmail}</Text> : null}
              </>
            ) : (
              <Text style={styles.linkHint}>Who is this follow-up for?</Text>
            )}
          </View>
          {personName.trim() ? (
            <PencilSimple size={18} color={colors.ink} weight="bold" />
          ) : (
            <Plus size={18} color={colors.ink} weight="bold" />
          )}
        </Pressable>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Owner</Text>
            <View style={styles.chips}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: owner === 'me' }}
                onPress={() => setOwner('me')}
                style={[styles.chip, owner === 'me' && styles.chipActive]}>
                <Text style={[styles.chipText, owner === 'me' && styles.chipTextActive]}>You</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: owner === 'guest' }}
                onPress={() => setOwner('guest')}
                style={[styles.chip, owner === 'guest' && styles.chipActive]}>
                <Text style={[styles.chipText, owner === 'guest' && styles.chipTextActive]}>
                  {personName.trim() || 'Them'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>How do {pronoun} want to follow up?</Text>
            <View style={styles.chips}>
              {SELECTABLE_FOLLOW_UP_CHANNELS.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: channel === option.id }}
                  onPress={() => setChannel(option.id)}
                  style={[styles.chip, channel === option.id && styles.chipActive]}>
                  <Text style={[styles.chipText, channel === option.id && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <FollowUpDuePicker dueAt={dueAt} onChange={setDueAt} label={`When should ${pronoun} do this?`} />

          <View style={styles.fieldGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: detailOpen }}
              onPress={() => setDetailOpen((value) => !value)}
              style={styles.detailToggle}>
              <Text style={styles.label}>What do {pronoun} need to do? (optional)</Text>
              {detailOpen ? (
                <CaretUp size={16} color={colors.ink} weight="bold" />
              ) : (
                <CaretDown size={16} color={colors.ink} weight="bold" />
              )}
            </Pressable>
            {detailOpen ? (
              <>
                <Text style={styles.linkHint}>Shown in your reminders so you know what this one&apos;s about.</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Send Sarah the revised product draft"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[styles.input, styles.inputMultiline]}
                />
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.x2 }]}>
        <Button loading={saving} disabled={saving} onPress={() => void submit()}>
          <CheckCircle size={19} color={colors.ink} weight="bold" />
          Add follow-up
        </Button>
      </View>

      <BottomSheet
        visible={addPersonSheetOpen}
        title="Add someone"
        onClose={() => {
          setAddPersonSheetOpen(false);
          setPersonSearchQuery('');
        }}>
        <View style={styles.searchRow}>
          <MagnifyingGlass size={18} color={colors.muted} weight="bold" />
          <TextInput
            value={personSearchQuery}
            onChangeText={setPersonSearchQuery}
            placeholder="Search your contacts"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.searchInput}
          />
          {personSearchQuery.trim() ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setPersonSearchQuery('')} hitSlop={8}>
              <X size={18} color={colors.muted} weight="bold" />
            </Pressable>
          ) : null}
        </View>

        {personSearchQuery.trim() && searchResults.length ? (
          <View style={styles.resultsList}>
            {searchResults.map((connection) => (
              <Pressable
                key={connection.id}
                accessibilityRole="button"
                onPress={() => pickConnection(connection)}
                style={styles.resultCard}>
                <Text style={styles.resultName}>{connection.name}</Text>
                <Text style={styles.linkHint}>{connection.email || connection.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        ) : !personSearchQuery.trim() ? (
          <View style={styles.personChoiceList}>
            <Pressable accessibilityRole="button" onPress={() => setManualOpen(true)} style={styles.personChoice}>
              <View style={styles.personChoiceIcon}>
                <PencilSimple size={20} color={colors.ink} weight="bold" />
              </View>
              <View style={styles.personChoiceCopy}>
                <Text style={styles.personChoiceTitle}>Add manually</Text>
                <Text style={styles.linkHint}>Enter their name and contact details</Text>
              </View>
              <CaretRight size={16} color={colors.muted} weight="bold" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setQrOpen(true)} style={styles.personChoice}>
              <View style={styles.personChoiceIcon}>
                <QrCode size={20} color={colors.ink} weight="bold" />
              </View>
              <View style={styles.personChoiceCopy}>
                <Text style={styles.personChoiceTitle}>Share QR code</Text>
                <Text style={styles.linkHint}>Let them scan your card and return their details</Text>
              </View>
              <CaretRight size={16} color={colors.muted} weight="bold" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void openScans()} style={styles.personChoice}>
              <View style={styles.personChoiceIcon}>
                <Scan size={20} color={colors.ink} weight="bold" />
              </View>
              <View style={styles.personChoiceCopy}>
                <Text style={styles.personChoiceTitle}>Recent scans</Text>
                <Text style={styles.linkHint}>Choose someone who recently scanned your card</Text>
              </View>
              <CaretRight size={16} color={colors.muted} weight="bold" />
            </Pressable>
          </View>
        ) : (
          <Body style={styles.centerCopy}>No contacts match &ldquo;{personSearchQuery.trim()}&rdquo;.</Body>
        )}
      </BottomSheet>

      <BottomSheet
        visible={manualOpen}
        title="Add someone"
        onClose={() => setManualOpen(false)}
        footer={<Button onPress={saveManualPerson}>Add person</Button>}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          value={manualName}
          onChangeText={setManualName}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          autoComplete="name"
          style={styles.input}
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={manualEmail}
          onChangeText={setManualEmail}
          placeholder="name@company.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
      </BottomSheet>

      <BottomSheet
        visible={qrOpen}
        title="Share your card"
        onClose={() => setQrOpen(false)}
        footer={
          <Button variant="secondary" onPress={() => { setQrOpen(false); router.push('/share-card'); }}>
            Open full-screen QR
          </Button>
        }>
        <Body style={styles.centerCopy}>They scan this code and their details link here automatically.</Body>
        <View style={styles.qrWrap}>
          <BrandedQrCode card={card} cardUrl={publicUrl} size={220} />
          <Text style={styles.qrHint}>{card.name}</Text>
        </View>
      </BottomSheet>

      <BottomSheet visible={scansOpen} title="Recent scans" onClose={() => setScansOpen(false)}>
        {loadingExchanges ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.linkHint}>Checking for new scans…</Text>
          </View>
        ) : exchanges.length ? (
          <View style={styles.resultsList}>
            {exchanges.map((exchange) => (
              <Pressable key={exchange.id} accessibilityRole="button" onPress={() => pickExchange(exchange)} style={styles.resultCard}>
                <Text style={styles.resultName}>{exchange.visitor_name || 'Unknown visitor'}</Text>
                <Text style={styles.linkHint}>
                  {[exchange.visitor_email, exchange.visitor_phone].filter(Boolean).join(' · ') || 'No contact yet'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Body style={styles.centerCopy}>No recent scans yet. Share your QR and new submissions appear here.</Body>
        )}
      </BottomSheet>

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.x5, gap: spacing.x2 },
  scroll: { flex: 1, marginTop: spacing.x4 },
  content: { paddingHorizontal: spacing.x5, gap: spacing.x3, paddingBottom: spacing.x4 },
  footer: {
    paddingHorizontal: spacing.x5,
    paddingTop: spacing.x3,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  linkHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  personTrigger: {
    minHeight: 72,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
  },
  personTriggerCopy: { flex: 1, gap: 2 },
  personTriggerName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  form: {
    gap: spacing.x4,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
  },
  fieldGroup: { gap: spacing.x3 },
  detailToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
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
  error: {
    padding: spacing.x3,
    borderRadius: radius.small,
    backgroundColor: '#FEE4E2',
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
    minHeight: 48,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  resultsList: { gap: spacing.x2, marginTop: spacing.x3 },
  resultCard: {
    gap: 2,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
  },
  resultName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  personChoiceList: { gap: spacing.x2, marginTop: spacing.x3 },
  personChoice: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x3,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
  },
  personChoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  personChoiceCopy: { flex: 1, gap: 2 },
  personChoiceTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  centerCopy: { textAlign: 'center', marginTop: spacing.x3 },
  qrWrap: { alignItems: 'center', gap: spacing.x3, marginTop: spacing.x4 },
  qrHint: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, marginTop: spacing.x3 },
});
