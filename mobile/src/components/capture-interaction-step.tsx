import { router } from 'expo-router';
import {
  CaretDown,
  CaretRight,
  CaretUp,
  CheckCircle,
  IdentificationCard,
  Microphone,
  PencilSimple,
  QrCode,
  Scan,
  Trash,
} from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandedQrCode } from '@/components/branded-qr-code';
import { BottomSheet } from '@/components/bottom-sheet';
import { PhoneInput } from '@/components/phone-input';
import { RecordingPlayOrb } from '@/components/recording-playback';
import { Body, Button } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import type { CaptureWizardDraft } from '@/features/encounters/capture-draft';
import type { InboundExchange } from '@/features/encounters/encounter-api';
import {
  createGatherPerson,
  formatPrimaryContactLine,
  MAX_GATHER_PEOPLE,
  syncLegacyPersonFields,
  updateGatherPerson,
  type GatherPerson,
} from '@/features/encounters/gather-people';
import type { CaptureRecorder } from '@/features/encounters/use-capture-recorder';
import { colors, radius, spacing } from '@/theme/tokens';

type CaptureInteractionStepProps = {
  draft: CaptureWizardDraft;
  onDraftChange: (changes: Partial<CaptureWizardDraft>) => void;
  consent: boolean;
  consentMethod: 'verbal' | 'written';
  onConsentChange: (value: boolean) => void;
  onConsentMethodChange: (value: 'verbal' | 'written') => void;
  recorder: CaptureRecorder;
  signedIn: boolean;
  exchanges: InboundExchange[];
  loadingExchanges: boolean;
  onLinkExchange: (exchange: InboundExchange) => void;
  onEnsureAuth: () => Promise<string | null>;
  getPriorMeetingCount?: (email: string) => number;
  knownConnectionEmails?: string[];
};

function metBeforeLabelForPerson(
  person: GatherPerson,
  getPriorMeetingCount?: (email: string) => number,
  knownConnectionEmails: string[] = [],
) {
  const email = person.email.trim().toLowerCase();
  const priorCount = getPriorMeetingCount?.(person.email) ?? 0;
  const knownConnection = email && knownConnectionEmails.includes(email);
  if (priorCount > 0) {
    return `You've met before · ${priorCount} conversation${priorCount === 1 ? '' : 's'}`;
  }
  if (knownConnection) return 'Already in your connections';
  return null;
}

function MeetingPersonCard({
  person,
  metBeforeLabel,
  onEdit,
  onRemove,
}: {
  person: GatherPerson;
  metBeforeLabel: string | null;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const contactLine = formatPrimaryContactLine(person);

  return (
    <View style={styles.personCard}>
      <CheckCircle size={20} color={colors.ink} weight="fill" />
      <View style={styles.personCopy}>
        <Text style={styles.personName}>{person.name.trim()}</Text>
        {contactLine ? <Text style={styles.personMeta}>{contactLine}</Text> : null}
        {person.exchangeId ? (
          <Text style={styles.personBadge}>From card scan</Text>
        ) : null}
        {metBeforeLabel ? (
          <Text style={styles.personHistoryBadge}>{metBeforeLabel}</Text>
        ) : null}
      </View>
      <View style={styles.personActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${person.name}`}
          onPress={onEdit}
          style={styles.iconButton}>
          <PencilSimple size={15} color={colors.ink} weight="bold" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${person.name}`}
          onPress={onRemove}
          style={styles.iconButton}>
          <Trash size={15} color={colors.danger} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

function PersonFields({
  person,
  onChange,
  personError,
}: {
  person: GatherPerson;
  onChange: (changes: Partial<GatherPerson>) => void;
  personError?: string;
}) {
  return (
    <>
      <Text style={styles.label}>Full name</Text>
      <TextInput
        value={person.name}
        onChangeText={(value) => onChange({ name: value })}
        placeholder="Full name"
        placeholderTextColor={colors.muted}
        autoComplete="name"
        style={styles.input}
      />
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={person.email}
        onChangeText={(value) => onChange({ email: value })}
        placeholder="name@company.com"
        placeholderTextColor={colors.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        style={styles.input}
      />
      <PhoneInput
        label="Phone (optional)"
        value={person.phone}
        onChange={(value) => onChange({ phone: value })}
      />
      <Text style={styles.label}>LinkedIn (optional)</Text>
      <TextInput
        value={person.linkedIn}
        onChangeText={(value) => onChange({ linkedIn: value })}
        placeholder="Profile URL or username"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={styles.input}
      />
      {personError ? <Text style={styles.error}>{personError}</Text> : null}
    </>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  disabled,
  badge,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionChip,
        pressed && !disabled && styles.actionChipPressed,
        disabled && styles.actionChipDisabled,
      ]}>
      <View style={styles.actionChipIcon}>{icon}</View>
      <Text style={styles.actionChipLabel}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function CaptureInteractionStep({
  draft,
  onDraftChange,
  consent,
  consentMethod,
  onConsentChange,
  onConsentMethodChange,
  recorder,
  signedIn,
  exchanges,
  loadingExchanges,
  onLinkExchange,
  onEnsureAuth,
  getPriorMeetingCount,
  knownConnectionEmails = [],
}: CaptureInteractionStepProps) {
  const { card, publicUrl } = useCard();
  const [consentSheetOpen, setConsentSheetOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [scansOpen, setScansOpen] = useState(false);
  const [peopleSheetOpen, setPeopleSheetOpen] = useState(false);
  const [personError, setPersonError] = useState('');
  const [formPerson, setFormPerson] = useState<GatherPerson>(createGatherPerson());
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [liveTranscriptOpen, setLiveTranscriptOpen] = useState(true);

  const people = draft.people ?? [];
  const atCapacity = people.length >= MAX_GATHER_PEOPLE;
  const methodLabel = consentMethod === 'verbal' ? 'Verbal consent' : 'Written consent';
  const isRecording = recorder.recordingState === 'recording' || recorder.recordingState === 'paused';
  const isImported = recorder.recordingSource === 'imported';
  const isTranscribingImport =
    recorder.serverTranscribePhase === 'preparing'
    || recorder.serverTranscribePhase === 'transcribing'
    || recorder.serverTranscribePhase === 'revealing'
    || recorder.transcriptStatus === 'transcribing';
  const showLiveTranscript =
    isRecording
    || recorder.recordingComplete
    || isTranscribingImport
    || Boolean(recorder.displayTranscript.trim())
    || recorder.serverTranscribePhase === 'failed'
    || recorder.serverTranscribePhase === 'preparing'
    || recorder.serverTranscribePhase === 'transcribing'
    || recorder.serverTranscribePhase === 'revealing';

  const liveTranscriptHint = (() => {
    switch (recorder.serverTranscribePhase) {
      case 'preparing':
        return 'Reading audio file…';
      case 'transcribing':
        return 'Transcribing recording…';
      case 'revealing':
        return 'Writing transcript…';
      case 'failed':
        return recorder.serverTranscribeError || 'Transcription failed';
      case 'done':
        return 'Transcript ready. Edit if needed';
      default:
        if (recorder.transcriptStatus === 'transcribing') return 'Transcribing recording…';
        if (recorder.transcriptStatus === 'receiving') return 'Receiving speech live…';
        if (recorder.transcriptStatus === 'listening') return 'Listening for words…';
        if (isRecording) return 'Listening for words…';
        return recorder.displayTranscript.trim() ? 'Editable meeting record' : 'Transcript will appear here';
    }
  })();

  const recorderTitle = isTranscribingImport
    ? 'Transcribing import'
    : recorder.recordingState === 'recording'
      ? 'Recording'
      : recorder.recordingState === 'paused'
        ? 'Paused'
        : recorder.recordingState === 'stopped'
          ? (isImported ? 'Imported recording' : 'Recording ready')
          : 'Ready to capture';

  function updatePeople(nextPeople: GatherPerson[]) {
    onDraftChange(syncLegacyPersonFields(nextPeople.slice(0, MAX_GATHER_PEOPLE)));
  }

  function openManualSheet(person?: GatherPerson) {
    setPersonError('');
    if (person) {
      setFormPerson({ ...person });
      setEditingPersonId(person.id);
    } else {
      setFormPerson(createGatherPerson());
      setEditingPersonId(null);
    }
    setManualOpen(true);
  }

  function validatePerson(person: GatherPerson) {
    if (person.name.trim().length < 2) {
      setPersonError('Enter their full name.');
      return false;
    }
    if (!person.email.trim().includes('@')) {
      setPersonError('Email is required.');
      return false;
    }
    setPersonError('');
    return true;
  }

  function savePerson() {
    if (!validatePerson(formPerson)) return;
    const normalized = createGatherPerson(formPerson);
    const nextPeople = editingPersonId
      ? people.map((person) => (person.id === editingPersonId ? { ...normalized, id: editingPersonId } : person))
      : [...people, normalized];
    updatePeople(nextPeople);
    setManualOpen(false);
    setEditingPersonId(null);
    setFormPerson(createGatherPerson());
  }

  function removePerson(personId: string) {
    updatePeople(people.filter((person) => person.id !== personId));
  }

  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setConsentSheetOpen(true)}
        style={[styles.consentChip, consent && styles.consentChipConfirmed]}>
        {consent ? (
          <CheckCircle size={18} color={colors.ink} weight="fill" />
        ) : (
          <Microphone size={18} color={colors.ink} weight="bold" />
        )}
        <Text style={styles.consentChipText}>
          {consent ? `${methodLabel} confirmed` : 'Confirm recording consent'}
        </Text>
        <CaretRight size={14} color={colors.muted} weight="bold" />
      </Pressable>

      {consent ? (
        <View style={[styles.recorderCard, isRecording && styles.recorderCardActive]}>
          <View style={styles.recorderRow}>
            {recorder.recordingState === 'stopped' && recorder.recordingUri ? (
              <RecordingPlayOrb uri={recorder.recordingUri} durationSeconds={recorder.seconds} size={44} />
            ) : (
              <View style={[styles.micOrb, recorder.recordingState === 'recording' && styles.micOrbActive]}>
                <Microphone
                  size={22}
                  color={recorder.recordingState === 'recording' ? colors.white : colors.ink}
                  weight="fill"
                />
              </View>
            )}
            <View style={styles.recorderMeta}>
              <Text style={styles.recorderTitle}>{recorderTitle}</Text>
              <Text style={styles.recorderHint}>
                {isTranscribingImport ? liveTranscriptHint : recorder.transcriptStatusLabel}
              </Text>
            </View>
            <Text style={styles.recorderTime}>{recorder.formattedDuration}</Text>
          </View>

          {isRecording ? (
            <View style={styles.audioMeter}>
              {Array.from({ length: 12 }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.audioBar,
                    { height: Math.max(4, recorder.audioLevel * (8 + ((index * 4) % 16))) },
                  ]}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.recorderActions}>
            {recorder.recordingState === 'idle' ? (
              <Button style={styles.flexButton} onPress={() => void recorder.startRecording(consent)}>
                Record
              </Button>
            ) : null}
            {isRecording ? (
              <>
                <Button variant="secondary" style={styles.flexButton} onPress={() => void recorder.pauseOrResume()}>
                  {recorder.recordingState === 'paused' ? 'Resume' : 'Pause'}
                </Button>
                <Button style={styles.flexButton} onPress={() => void recorder.stopRecording()}>
                  Finish
                </Button>
              </>
            ) : null}
            {recorder.recordingState === 'stopped' ? (
              <Button variant="secondary" onPress={() => void recorder.resetRecording()}>
                Record again
              </Button>
            ) : null}
          </View>

          {showLiveTranscript ? (
            <View style={styles.liveTranscriptPanel}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: liveTranscriptOpen }}
                onPress={() => setLiveTranscriptOpen((open) => !open)}
                style={styles.liveTranscriptHead}>
                <View style={styles.liveTranscriptHeadCopy}>
                  <Text style={styles.liveTranscriptTitle}>Live transcript</Text>
                  <Text style={styles.liveTranscriptHint}>{liveTranscriptHint}</Text>
                </View>
                {isTranscribingImport ? (
                  <ActivityIndicator color={colors.ink} size="small" />
                ) : liveTranscriptOpen ? (
                  <CaretUp size={16} color={colors.ink} weight="bold" />
                ) : (
                  <CaretDown size={16} color={colors.ink} weight="bold" />
                )}
              </Pressable>
              {liveTranscriptOpen ? (
                <>
                  <TextInput
                    value={recorder.displayTranscript}
                    onChangeText={recorder.updateTranscriptFromUser}
                    placeholder={
                      isTranscribingImport
                        ? 'Words will appear here as we transcribe your import…'
                        : 'Your transcript appears here while you record, or paste one manually…'
                    }
                    placeholderTextColor={colors.muted}
                    multiline
                    scrollEnabled
                    style={styles.liveTranscriptField}
                  />
                  {recorder.serverTranscribePhase === 'failed' ? (
                    <View style={styles.transcribeFailRow}>
                      <Text style={styles.transcribeFailText}>{recorder.serverTranscribeError}</Text>
                      <Button variant="secondary" onPress={() => void recorder.retryTranscription()}>
                        Retry transcription
                      </Button>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

        </View>
      ) : null}

      <View style={styles.peopleSection}>
        <View style={styles.sectionHead}>
          <IdentificationCard size={18} color={colors.ink} weight="bold" />
          <View style={styles.sectionHeadCopy}>
            <Text style={styles.sectionTitle}>Who&apos;s in this meeting?</Text>
            <Text style={styles.sectionHint}>Add people while you record. Pausing won&apos;t stop this.</Text>
          </View>
        </View>

        {people.length ? (
          <View style={styles.peopleList}>
            <MeetingPersonCard
              person={people[0]}
              metBeforeLabel={metBeforeLabelForPerson(people[0], getPriorMeetingCount, knownConnectionEmails)}
              onEdit={() => openManualSheet(people[0])}
              onRemove={() => removePerson(people[0].id)}
            />
            {people.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPeopleSheetOpen(true)}
                style={styles.viewAllPeople}>
                <Text style={styles.viewAllPeopleText}>
                  View all {people.length} people
                </Text>
                <CaretRight size={14} color={colors.inkSoft} weight="bold" />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyPeople}>
            <Text style={styles.emptyPeopleText}>No one added yet. Use the options below.</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <ActionChip
            icon={<PencilSimple size={20} color={colors.ink} weight="bold" />}
            label="Add manually"
            onPress={() => openManualSheet()}
            disabled={atCapacity}
          />
          <ActionChip
            icon={<QrCode size={20} color={colors.ink} weight="bold" />}
            label="Share QR"
            onPress={() => setQrOpen(true)}
          />
          <ActionChip
            icon={<Scan size={20} color={colors.ink} weight="bold" />}
            label="Recent scans"
            onPress={() => (signedIn ? setScansOpen(true) : void onEnsureAuth())}
            badge={exchanges.length}
          />
        </View>
      </View>

      <BottomSheet
        visible={consentSheetOpen}
        title="Recording consent"
        onClose={() => setConsentSheetOpen(false)}
        footer={
          <Button onPress={() => setConsentSheetOpen(false)}>
            {consent ? 'Done' : 'Close'}
          </Button>
        }>
        <Body>
          Ask clearly: “Is everyone comfortable with me recording this conversation so I can remember the agreed next steps?”
        </Body>
        <View style={styles.consentRow}>
          <Text style={styles.consentLabel}>Everyone agreed</Text>
          <Switch
            value={consent}
            onValueChange={onConsentChange}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.methodHeading}>How was consent given?</Text>
        <View style={styles.methodRow}>
          {(['verbal', 'written'] as const).map((method) => (
            <Pressable
              key={method}
              accessibilityRole="button"
              onPress={() => onConsentMethodChange(method)}
              style={[styles.methodChip, consentMethod === method && styles.methodChipActive]}>
              <Text style={[styles.methodText, consentMethod === method && styles.methodTextActive]}>
                {method === 'verbal' ? 'Verbal' : 'Written'}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={manualOpen}
        title={editingPersonId ? 'Edit person' : 'Add person'}
        onClose={() => setManualOpen(false)}
        footer={<Button onPress={savePerson}>{editingPersonId ? 'Save changes' : 'Add person'}</Button>}>
        <PersonFields
          person={formPerson}
          onChange={(changes) => setFormPerson((current) => updateGatherPerson(current, changes))}
          personError={personError}
        />
      </BottomSheet>

      <BottomSheet
        visible={qrOpen}
        title="Share your card"
        onClose={() => setQrOpen(false)}
        footer={
          <Button variant="secondary" onPress={() => {
            setQrOpen(false);
            router.push('/share-card');
          }}>
            Open full-screen QR
          </Button>
        }>
        <Body style={styles.centerCopy}>They scan this code and their details link here automatically.</Body>
        <View style={styles.qrWrap}>
          <BrandedQrCode card={card} cardUrl={publicUrl} size={220} />
          <Text style={styles.qrHint}>{card.name}</Text>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={scansOpen}
        title="Recent scans"
        onClose={() => setScansOpen(false)}>
        {!signedIn ? (
          <Button onPress={() => void onEnsureAuth()}>Sign in to see recent scans</Button>
        ) : loadingExchanges ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.loadingText}>Checking for new scans…</Text>
          </View>
        ) : exchanges.length ? (
          <View style={styles.exchangeList}>
            {exchanges.map((exchange) => {
              const selected = people.some((person) => person.exchangeId === exchange.id);
              const disabled = selected || atCapacity;
              return (
                <Pressable
                  key={exchange.id}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => {
                    onLinkExchange(exchange);
                    setScansOpen(false);
                  }}
                  style={[
                    styles.exchangeCard,
                    selected && styles.exchangeCardSelected,
                    disabled && !selected && styles.exchangeCardDisabled,
                  ]}>
                  <Text style={styles.exchangeName}>{exchange.visitor_name || 'Unknown visitor'}</Text>
                  <Text style={styles.exchangeMeta}>
                    {[exchange.visitor_email, exchange.visitor_phone].filter(Boolean).join(' · ')
                      || exchange.visitor_company
                      || 'No contact yet'}
                  </Text>
                  {selected ? <Text style={styles.exchangeSelected}>Added</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Body style={styles.centerCopy}>No recent scans yet. Share your QR and new submissions appear here.</Body>
        )}
      </BottomSheet>

      <BottomSheet
        visible={peopleSheetOpen}
        title={`In this meeting (${people.length})`}
        onClose={() => setPeopleSheetOpen(false)}>
        <View style={styles.peopleList}>
          {people.map((person) => (
            <MeetingPersonCard
              key={person.id}
              person={person}
              metBeforeLabel={metBeforeLabelForPerson(person, getPriorMeetingCount, knownConnectionEmails)}
              onEdit={() => {
                setPeopleSheetOpen(false);
                openManualSheet(person);
              }}
              onRemove={() => removePerson(person.id)}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.x5 },
  consentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  consentChipConfirmed: { backgroundColor: colors.surfaceMuted },
  consentChipText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  recorderCard: {
    gap: spacing.x4,
    padding: spacing.x5,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  recorderCardActive: { borderColor: colors.ink },
  recorderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  micOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  micOrbActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  recorderMeta: { flex: 1, gap: 2 },
  recorderTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  recorderHint: { color: colors.muted, fontSize: 12 },
  recorderTime: { color: colors.ink, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  audioMeter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    minHeight: 24,
    paddingHorizontal: spacing.x1,
  },
  audioBar: { flex: 1, borderRadius: 2, backgroundColor: colors.accent },
  recorderActions: { flexDirection: 'row', gap: spacing.x3 },
  flexButton: { flex: 1 },
  liveTranscriptPanel: {
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  liveTranscriptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.x3,
  },
  liveTranscriptHeadCopy: { flex: 1, gap: 2 },
  liveTranscriptTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  liveTranscriptHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  liveTranscriptField: {
    minHeight: 140,
    maxHeight: 220,
    padding: spacing.x3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  transcribeFailRow: { gap: spacing.x3 },
  transcribeFailText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  peopleSection: { gap: spacing.x4 },
  sectionHead: { flexDirection: 'row', gap: spacing.x3, alignItems: 'flex-start' },
  sectionHeadCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  peopleList: { gap: spacing.x2 },
  personCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.large,
    backgroundColor: '#EAF6E4',
    borderWidth: 1,
    borderColor: '#CFE8C0',
  },
  personCopy: { flex: 1, gap: 2 },
  personName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  personMeta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  personBadge: { marginTop: 2, color: colors.ink, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  personHistoryBadge: { marginTop: 2, color: colors.inkSoft, fontSize: 11, fontWeight: '800' },
  viewAllPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    paddingVertical: spacing.x3,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  viewAllPeopleText: { color: colors.link, fontSize: 13, fontWeight: '800' },
  personActions: { flexDirection: 'row', gap: spacing.x2 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#CFE8C0',
  },
  emptyPeople: {
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyPeopleText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.x2 },
  actionChip: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.x2,
    paddingVertical: spacing.x3,
    paddingHorizontal: spacing.x2,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    position: 'relative',
  },
  actionChipPressed: { opacity: 0.75 },
  actionChipDisabled: { opacity: 0.45 },
  actionChipIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  actionChipLabel: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
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
  error: { color: colors.danger, fontSize: 12 },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.x2,
  },
  consentLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  methodHeading: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  methodRow: { flexDirection: 'row', gap: spacing.x2 },
  methodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.x3,
    borderRadius: radius.round,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  methodChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  methodText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  methodTextActive: { fontWeight: '900' },
  centerCopy: { textAlign: 'center' },
  qrWrap: { alignItems: 'center', gap: spacing.x2, padding: spacing.x4, backgroundColor: colors.canvas, borderRadius: radius.medium },
  qrHint: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3, paddingVertical: spacing.x2 },
  loadingText: { color: colors.muted, fontSize: 14 },
  exchangeList: { gap: spacing.x3 },
  exchangeCard: {
    gap: spacing.x1,
    padding: spacing.x4,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  exchangeCardSelected: { borderColor: colors.ink, backgroundColor: colors.surfaceMuted },
  exchangeCardDisabled: { opacity: 0.55 },
  exchangeName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  exchangeMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  exchangeSelected: { color: colors.ink, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  transcriptSheetHint: { color: colors.muted, fontSize: 13 },
  transcriptField: {
    minHeight: 220,
    maxHeight: 320,
    padding: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
