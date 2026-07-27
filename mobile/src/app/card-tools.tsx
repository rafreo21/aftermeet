import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Code,
  ContactlessPayment,
  Copy,
  EnvelopeSimple,
  GoogleLogo,
  SquaresFour,
  Wallet,
} from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton, Body, Button, Eyebrow, Panel } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useCard } from '@/features/card/card-context';
import { showsCompanyDetails } from '@/features/card/company-display';
import { copyNfcManufacturerPayload, isNativeNfcSupported, programNfcTag } from '@/features/card/nfc-actions';
import { updateQuickShareWidget } from '@/features/card/widget-sync';
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
    const profile = {
      name: card.name,
      role: card.role,
      company: card.company,
      cardUrl: publicUrl,
      showCompany,
    };
    const value = kind === 'plain' ? buildPlainSignature(profile) : buildHtmlSignature(profile);
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
                  <Text style={styles.note}>{walletNote}</Text>
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
                  <Text style={styles.note}>{walletNote}</Text>
                ) : null}
              </>
            ) : null}
            {isNativeNfcSupported() ? (
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
            ) : null}
            <Button
              variant="ghost"
              onPress={() => void run('nfc-copy', async () => {
                await copyNfcManufacturerPayload(publicUrl);
                setMessage('Manufacturer payload copied.');
              })}>
              <Copy size={16} color={colors.ink} weight="bold" />
              Copy NFC payload
            </Button>
            {!isNativeNfcSupported() ? (
              <Text style={styles.note}>NFC writing works on Android. iPhone can read tags but cannot write them from the app.</Text>
            ) : null}
          </Panel>

          <Panel style={styles.section}>
            <Text style={styles.panelTitle}>Email signature</Text>
            <Body>Paste this into Gmail, Outlook, or Apple Mail.</Body>
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
            <Body>Add the Quick Share widget to your home screen for one-tap QR sharing.</Body>
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
                setMessage(Platform.OS === 'android'
                  ? 'Widget updated. Add it from your Android home screen if you have not already.'
                  : 'Widget updated. Add Quick Share from the iOS widget gallery.');
              })}>
              <SquaresFour size={18} color={colors.ink} weight="bold" />
              Refresh home-screen widget
            </Button>
            <Text style={styles.note}>
              {Platform.OS === 'android'
                ? 'Long-press your home screen → Widgets → AfterMeet Quick Share.'
                : 'Long-press your home screen → Edit → search AfterMeet Quick Share.'}
            </Text>
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
