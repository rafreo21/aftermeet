import { useCard } from '@/features/card/card-context';
import type { CaptureWizardDraft } from '@/features/encounters/capture-draft';
import type { InboundExchange } from '@/features/encounters/encounter-api';
import {
  ContextGenerationBanner,
  type ContextGenerationStatus,
} from '@/components/context-generation-banner';
import { BottomSheet } from '@/components/bottom-sheet';
import { Body, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { CheckCircle, IdentificationCard, PencilSimple, QrCode } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { router } from 'expo-router';

type CaptureGatherStepProps = {
  draft: CaptureWizardDraft;
  onDraftChange: (changes: Partial<CaptureWizardDraft>) => void;
  generationStatus: ContextGenerationStatus;
  generationStartedAt: number | null;
  generationError: string;
  onDismissReady: () => void;
  exchanges: InboundExchange[];
  loadingExchanges: boolean;
  signedIn: boolean;
  onLinkExchange: (exchange: InboundExchange) => void;
  onEnsureAuth: () => Promise<string | null>;
};

function formatContactLine(draft: CaptureWizardDraft) {
  const parts = [draft.personEmail.trim(), draft.personPhone.trim()].filter(Boolean);
  return parts.join(' · ');
}

function PersonFields({
  draft,
  onDraftChange,
  personError,
}: {
  draft: CaptureWizardDraft;
  onDraftChange: (changes: Partial<CaptureWizardDraft>) => void;
  personError?: string;
}) {
  return (
    <>
      <Text style={styles.label}>Full name</Text>
      <TextInput
        value={draft.personName}
        onChangeText={(value) => onDraftChange({ personName: value, personAcknowledged: false })}
        placeholder="Full name"
        placeholderTextColor={colors.muted}
        autoComplete="name"
        style={styles.input}
      />
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={draft.personEmail}
        onChangeText={(value) => onDraftChange({ personEmail: value, personAcknowledged: false })}
        placeholder="name@company.com"
        placeholderTextColor={colors.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        style={styles.input}
      />
      <Text style={styles.label}>Phone (optional)</Text>
      <TextInput
        value={draft.personPhone}
        onChangeText={(value) => onDraftChange({ personPhone: value })}
        placeholder="+44 …"
        placeholderTextColor={colors.muted}
        keyboardType="phone-pad"
        autoComplete="tel"
        style={styles.input}
      />
      <Text style={styles.label}>LinkedIn (optional)</Text>
      <TextInput
        value={draft.personLinkedIn}
        onChangeText={(value) => onDraftChange({ personLinkedIn: value })}
        placeholder="Profile URL or username"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={styles.input}
      />
      {personError ? <Text style={styles.error}>{personError}</Text> : null}
    </>
  );
}

export function CaptureGatherStep({
  draft,
  onDraftChange,
  generationStatus,
  generationStartedAt,
  generationError,
  onDismissReady,
  exchanges,
  loadingExchanges,
  signedIn,
  onLinkExchange,
  onEnsureAuth,
}: CaptureGatherStepProps) {
  const { card, publicUrl } = useCard();
  const [showQr, setShowQr] = useState(false);
  const [personError, setPersonError] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const personAcknowledged =
    Boolean(draft.personAcknowledged)
    || (Boolean(draft.exchangeId) && Boolean(draft.personName.trim()));

  function validatePerson() {
    const name = draft.personName.trim();
    const email = draft.personEmail.trim();
    if (name.length < 2) {
      setPersonError('Enter their full name.');
      return false;
    }
    if (!email || !email.includes('@')) {
      setPersonError('Email is required.');
      return false;
    }
    setPersonError('');
    return true;
  }

  function savePersonManual() {
    if (!validatePerson()) return;
    onDraftChange({ personAcknowledged: true });
  }

  function savePersonEdit() {
    if (!validatePerson()) return;
    onDraftChange({ personAcknowledged: true });
    setEditOpen(false);
  }

  return (
    <View style={styles.stack}>
      <ContextGenerationBanner
        status={generationStatus}
        startedAt={generationStartedAt}
        errorMessage={generationError}
        onDismissReady={onDismissReady}
      />

      {personAcknowledged ? (
        <View style={styles.addedCard}>
          <CheckCircle size={22} color={colors.ink} weight="fill" />
          <View style={styles.addedCopy}>
            <Text style={styles.addedTitle}>{draft.personName.trim()} added</Text>
            <Text style={styles.addedMeta}>{formatContactLine(draft) || 'Contact saved'}</Text>
            {draft.personLinkedIn.trim() ? (
              <Text style={styles.addedMeta}>{draft.personLinkedIn.trim()}</Text>
            ) : null}
            {draft.exchangeId ? (
              <Text style={styles.addedBadge}>Linked from your card scan</Text>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setEditOpen(true)} style={styles.editButton}>
            <PencilSimple size={16} color={colors.ink} weight="bold" />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <IdentificationCard size={18} color={colors.ink} weight="bold" />
              <Text style={styles.blockTitle}>Who did you meet?</Text>
            </View>
            <Body>Use this time while context loads — add them manually or let them scan your QR.</Body>
            <PersonFields draft={draft} onDraftChange={onDraftChange} personError={personError} />
            <Button variant="secondary" onPress={savePersonManual}>
              Save person
            </Button>
          </View>

          <View style={styles.block}>
            <View style={styles.blockHead}>
              <QrCode size={18} color={colors.ink} weight="bold" />
              <Text style={styles.blockTitle}>Share your card</Text>
            </View>
            <Body>They scan your QR and send their details — we link them automatically.</Body>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowQr((value) => !value)}
              style={styles.qrToggle}>
              <Text style={styles.qrToggleText}>{showQr ? 'Hide QR code' : 'Show QR code'}</Text>
            </Pressable>
            {showQr ? (
              <View style={styles.qrWrap}>
                <QRCode value={publicUrl} size={200} color={colors.ink} backgroundColor={colors.white} />
                <Text style={styles.qrHint}>{card.name}</Text>
              </View>
            ) : null}
            <Button variant="secondary" onPress={() => router.push('/share-card')}>
              Open full-screen QR
            </Button>
          </View>

          {signedIn ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Recent scans</Text>
              {loadingExchanges ? (
                <Text style={styles.muted}>Checking for new details…</Text>
              ) : exchanges.length ? (
                <View style={styles.exchangeList}>
                  {exchanges.map((exchange) => {
                    const selected = draft.exchangeId === exchange.id;
                    return (
                      <Pressable
                        key={exchange.id}
                        accessibilityRole="button"
                        onPress={() => onLinkExchange(exchange)}
                        style={[styles.exchangeCard, selected && styles.exchangeCardSelected]}>
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
                <Text style={styles.muted}>Waiting for them to scan — recent submissions appear here.</Text>
              )}
            </View>
          ) : (
            <Button onPress={() => void onEnsureAuth()}>Sign in to detect QR submissions</Button>
          )}
        </>
      )}

      <BottomSheet
        visible={editOpen}
        title="Edit person"
        onClose={() => setEditOpen(false)}
        footer={<Button onPress={savePersonEdit}>Save changes</Button>}>
        <PersonFields draft={draft} onDraftChange={onDraftChange} personError={personError} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.x4 },
  block: {
    gap: spacing.x3,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  blockTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
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
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  addedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: '#EAF6E4',
    borderWidth: 1,
    borderColor: '#CFE8C0',
  },
  addedCopy: { flex: 1, gap: 2 },
  addedTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  addedMeta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  addedBadge: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    borderRadius: radius.round,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#CFE8C0',
  },
  editText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  qrToggle: { alignSelf: 'flex-start' },
  qrToggleText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  qrWrap: {
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x5,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
  },
  qrHint: { color: colors.muted, fontSize: 13 },
  exchangeList: { gap: spacing.x3 },
  exchangeCard: {
    gap: spacing.x1,
    padding: spacing.x4,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  exchangeCardSelected: {
    borderColor: colors.ink,
    backgroundColor: colors.surfaceMuted,
  },
  exchangeName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  exchangeMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  exchangeSelected: { color: colors.ink, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
});
