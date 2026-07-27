import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Code,
  ContactlessPayment,
  Copy,
  EnvelopeSimple,
  GoogleLogo,
  LinkSimple,
  SquaresFour,
  Wallet,
} from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton, Body, Button, Eyebrow, Panel } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useCard } from '@/features/card/card-context';
import { showsCompanyDetails } from '@/features/card/company-display';
import {
  copyNfcCardLink,
  copyNfcManufacturerPayload,
  isNativeNfcSupported,
  openNfcSettings,
  programNfcTag,
} from '@/features/card/nfc-actions';
import { updateQuickShareWidget, widgetSetupInstructions } from '@/features/card/widget-sync';
import {
  addAppleWalletPass,
  addGoogleWalletPass,
  fetchWalletAvailability,
} from '@/features/card/wallet-actions';
import { buildHtmlSignature, buildPlainSignature } from '@/lib/email-signature';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CardToolsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { card: activeCard, getCardById, cardPublicUrl } = useCard();
  const { session } = useAuth();
  const insets = useAppInsets();
  const card = (id ? getCardById(id) : undefined) || activeCard;
  const publicUrl = cardPublicUrl(card);
  const showCompany = showsCompanyDetails(card);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [walletNote, setWalletNote] = useState('');

  const subtitle = [card.role, showCompany ? card.company : ''].filter(Boolean).join(' · ');
  const signatureProfile = useMemo(() => ({
    name: card.name,
    role: card.role,
    company: card.company,
    cardUrl: publicUrl,
    showCompany,
    photoUrl: card.photo,
    email: card.methods.find((method) => method.type === 'email')?.value,
    phone: card.methods.find((method) => method.type === 'phone')?.value,
    themeColor: card.theme,
  }), [card, publicUrl, showCompany]);

  useEffect(() => {
    if (!session?.access_token || card.status !== 'published' || !card.slug) {
      setWalletAvailable(null);
      setWalletNote('');
      return;
    }

    let cancelled = false;
    void fetchWalletAvailability(card.slug, session.access_token).then((result) => {
      if (cancelled) return;
      setWalletAvailable(result.available);
      setWalletNote(result.message);
    });

    return () => {
      cancelled = true;
    };
  }, [card.slug, card.status, session?.access_token]);

  async function run(action: string, task: () => Promise<void>) {
    setBusy(action);
    setError('');
    setMessage('');
    try {
      await task();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy('');
    }
  }

  async function copySignature(kind: 'plain' | 'html') {
    const value = kind === 'plain'
      ? buildPlainSignature(signatureProfile)
      : buildHtmlSignature(signatureProfile);
    await Clipboard.setStringAsync(value);
    setCopied(kind);
    setTimeout(() => setCopied(''), 1500);
    setMessage(kind === 'plain' ? 'Plain signature copied.' : 'HTML signature copied.');
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.headerCopy}>
            <Eyebrow>Card tools</Eyebrow>
            <Text style={styles.title}>Wallet, NFC & signature</Text>
            <Body style={styles.subtitle}>Everything you need to use {card.name || 'your card'} from your phone.</Body>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.x6 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {!session ? (
            <Panel>
              <Text style={styles.panelTitle}>Sign in to sync tools</Text>
              <Body>Publish your card first, then unlock Wallet and NFC on this device.</Body>
              <Button onPress={() => router.push('/auth')}>Sign in</Button>
            </Panel>
          ) : card.status !== 'published' ? (
            <Panel>
              <Text style={styles.panelTitle}>Publish your card</Text>
              <Body>Wallet passes and NFC need a live public link.</Body>
              <Button onPress={() => router.push('/(tabs)/card')}>Go to my card</Button>
            </Panel>
          ) : null}

          <Panel style={styles.section}>
            <Text style={styles.panelTitle}>Wallet passes and NFC</Text>
            <Body>Save your card to Wallet or program a tag that opens your link.</Body>
            {Platform.OS === 'ios' ? (
              <>
                <Button
                  loading={busy === 'apple'}
                  disabled={walletAvailable === false}
                  onPress={() => void run('apple', async () => {
                    if (!session?.access_token) throw new Error('Sign in required.');
                    await addAppleWalletPass(card.slug, session.access_token);
                    setMessage('Choose Add to Wallet from the share sheet.');
                  })}>
                  <Wallet size={18} color={colors.ink} weight="bold" />
                  Add to Apple Wallet
                </Button>
                {walletAvailable === false && walletNote ? (
                  <Text style={styles.note}>{walletNote} Ask your admin to add Apple Wallet signing keys on the server.</Text>
                ) : null}
              </>
            ) : null}
            {Platform.OS === 'android' ? (
              <>
                <Button
                  loading={busy === 'google'}
                  disabled={walletAvailable === false}
                  onPress={() => void run('google', async () => {
                    if (!session?.access_token) throw new Error('Sign in required.');
                    await addGoogleWalletPass(card.slug, session.access_token);
                    setMessage('Finish adding the pass in Google Wallet.');
                  })}>
                  <GoogleLogo size={18} color={colors.ink} weight="bold" />
                  Add to Google Wallet
                </Button>
                {walletAvailable === false && walletNote ? (
                  <Text style={styles.note}>{walletNote} Ask your admin to add GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SERVICE_ACCOUNT_JSON on Vercel.</Text>
                ) : null}
              </>
            ) : null}
            {isNativeNfcSupported() ? (
              <>
                <Button
                  variant="secondary"
                  loading={busy === 'nfc'}
                  onPress={() => void run('nfc', async () => {
                    await programNfcTag(publicUrl);
                    setMessage('NFC tag programmed. Tap it with a phone to open your card.');
                  })}>
                  <ContactlessPayment size={18} color={colors.ink} weight="bold" />
                  Program NFC tag
                </Button>
                <Button variant="ghost" onPress={() => void openNfcSettings()}>
                  Open NFC settings
                </Button>
              </>
            ) : (
              <Text style={styles.note}>NFC writing works on Android. iPhone can read tags but cannot write them from the app.</Text>
            )}
            <Button
              variant="secondary"
              loading={busy === 'nfc-link'}
              onPress={() => void run('nfc-link', async () => {
                const value = await copyNfcCardLink(publicUrl);
                setMessage(`Card link copied: ${value}`);
              })}>
              <LinkSimple size={16} color={colors.ink} weight="bold" />
              Copy card link for NFC
            </Button>
            <Button
              variant="ghost"
              loading={busy === 'nfc-copy'}
              onPress={() => void run('nfc-copy', async () => {
                await copyNfcManufacturerPayload(publicUrl);
                setMessage('Programming JSON copied for manufacturer tools.');
              })}>
              <Copy size={16} color={colors.ink} weight="bold" />
              Copy NFC programming JSON
            </Button>
          </Panel>

          <Panel style={styles.section}>
            <Text style={styles.panelTitle}>Email signature</Text>
            <Body>Paste the HTML version into Gmail, Outlook, or Apple Mail signature settings.</Body>
            <View style={styles.signaturePreview}>
              <View style={[styles.signatureAccent, { backgroundColor: card.theme || colors.accent }]} />
              <View style={styles.signatureBody}>
                <Text style={styles.signatureName}>{card.name || 'Your name'}</Text>
                {subtitle ? <Text style={styles.signatureSubtitle}>{subtitle}</Text> : null}
                <View style={styles.signatureButtonPreview}>
                  <Text style={styles.signatureButtonText}>View my card</Text>
                </View>
                <Text style={styles.signatureFooter}>Shared with AfterMeet</Text>
              </View>
            </View>
            <Button variant="secondary" onPress={() => void copySignature('plain')}>
              <EnvelopeSimple size={18} color={colors.ink} weight="bold" />
              {copied === 'plain' ? 'Plain copied' : 'Copy plain signature'}
            </Button>
            <Button variant="ghost" onPress={() => void copySignature('html')}>
              <Code size={16} color={colors.ink} weight="bold" />
              {copied === 'html' ? 'HTML copied' : 'Copy HTML signature'}
            </Button>
          </Panel>

          <Panel style={styles.section}>
            <Text style={styles.panelTitle}>Use this card from your phone</Text>
            <Body>{widgetSetupInstructions(Platform.OS === 'android' ? 'android' : 'ios')}</Body>
            <View style={styles.widgetPreview}>
              <Text style={styles.widgetEyebrow}>AfterMeet</Text>
              <Text style={styles.widgetName}>{card.name}</Text>
              {subtitle ? <Text style={styles.widgetSubtitle}>{subtitle}</Text> : null}
              <Text style={styles.widgetButton}>Open QR →</Text>
            </View>
            <Button
              variant="secondary"
              loading={busy === 'widget'}
              onPress={() => void run('widget', async () => {
                await updateQuickShareWidget(card, publicUrl);
                setMessage('Widget updated. Add or refresh it on your home screen, then tap Open QR.');
              })}>
              <SquaresFour size={18} color={colors.ink} weight="bold" />
              Refresh home-screen widget
            </Button>
          </Panel>

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1 },
  header: {
    gap: spacing.x3,
    paddingHorizontal: spacing.x5,
  },
  headerCopy: { gap: spacing.x2 },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  subtitle: { marginTop: 2 },
  scroll: { flex: 1, marginTop: spacing.x4 },
  scrollContent: {
    paddingHorizontal: spacing.x5,
    gap: spacing.x4,
  },
  section: { gap: spacing.x3 },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  signaturePreview: {
    flexDirection: 'row',
    borderRadius: radius.medium,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  signatureAccent: { width: 5 },
  signatureBody: { flex: 1, padding: spacing.x4, gap: 4 },
  signatureName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  signatureSubtitle: { color: colors.muted, fontSize: 13 },
  signatureButtonPreview: {
    marginTop: spacing.x2,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.ink,
  },
  signatureButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  signatureFooter: { marginTop: spacing.x2, color: colors.muted, fontSize: 11 },
  widgetPreview: {
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: '#E9F7DF',
    gap: 4,
  },
  widgetEyebrow: { color: '#2F5711', fontSize: 11, fontWeight: '800' },
  widgetName: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  widgetSubtitle: { color: colors.muted, fontSize: 12 },
  widgetButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  success: { color: '#2F5711', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
