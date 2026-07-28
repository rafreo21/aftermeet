import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  CaretRight,
  ContactlessPayment,
  EnvelopeSimple,
  Monitor,
  PencilSimple,
  SquaresFour,
  Wallet,
  Watch,
} from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { CardToolErrorSheet } from '@/components/card-tool-error-sheet';
import { BackButton, Body, Button, Eyebrow, Panel } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  BackgroundToolSheetContent,
  cardToolInitials,
  cardToolShowCompany,
  NfcToolSheetContent,
  SignatureToolSheetContent,
  WalletToolSheetContent,
  WatchToolSheetContent,
  WidgetToolSheetContent,
} from '@/features/card/card-tool-sheets';
import { syncCardToolsForCard } from '@/features/card/card-tools-sync';
import { useCard } from '@/features/card/card-context';
import { themeSurfaceStyle } from '@/features/card/theme-colors';
import { fetchWalletAvailability } from '@/features/card/wallet-actions';
import { buildHtmlSignature, buildPlainSignature } from '@/lib/email-signature';
import { fetchBrandedQrDataUri } from '@/lib/branded-qr-client';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

type ToolSheet = 'none' | 'wallet' | 'nfc' | 'widgets' | 'signature' | 'watch' | 'background';

type ToolRowProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function ToolRow({ icon, title, subtitle, onPress }: ToolRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.toolRow, pressed && styles.toolRowPressed]}>
      <View style={styles.toolIcon}>{icon}</View>
      <View style={styles.toolCopy}>
        <Text style={styles.toolTitle}>{title}</Text>
        <Text style={styles.toolSubtitle}>{subtitle}</Text>
      </View>
      <CaretRight size={18} color={colors.muted} weight="bold" />
    </Pressable>
  );
}

export default function CardToolsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { cards, card: activeCard, getCardById, cardPublicUrl } = useCard();
  const { session } = useAuth();
  const insets = useAppInsets();
  const card = useMemo(
    () => (id ? getCardById(String(id)) : undefined),
    [getCardById, id, cards],
  );
  const publicUrl = card ? cardPublicUrl(card) : '';
  const showCompany = card ? cardToolShowCompany(card) : false;
  const theme = useMemo(
    () => themeSurfaceStyle(card?.theme || colors.accent),
    [card?.theme],
  );

  const [activeSheet, setActiveSheet] = useState<ToolSheet>('none');
  const [message, setMessage] = useState('');
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [walletNote, setWalletNote] = useState('');

  useEffect(() => {
    if (!id && activeCard.id) {
      router.replace(`/card-tools?id=${activeCard.id}`);
    }
  }, [activeCard.id, id]);

  useFocusEffect(
    useCallback(() => {
      if (!card || !session?.access_token) return;
      void syncCardToolsForCard(cards, cardPublicUrl, session.access_token, card);
    }, [card, cards, cardPublicUrl, session?.access_token]),
  );

  useEffect(() => {
    if (!card || !session?.access_token || card.status !== 'published' || !card.slug) {
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
  }, [card, session?.access_token]);

  const initials = card ? cardToolInitials(card) : 'AM';
  const subtitle = card ? [card.role, showCompany ? card.company : ''].filter(Boolean).join(' · ') : '';
  const signatureProfile = useMemo(() => ({
    name: card?.name || '',
    role: card?.role || '',
    company: card?.company || '',
    cardUrl: publicUrl,
    showCompany,
    photoUrl: card?.photo,
    email: card?.methods.find((method) => method.type === 'email')?.value,
    phone: card?.methods.find((method) => method.type === 'phone')?.value,
    themeColor: card?.theme,
  }), [card, publicUrl, showCompany]);

  const run = useCallback(async (action: string, task: () => Promise<void>) => {
    setBusy(action);
    setMessage('');
    try {
      await task();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      const nextMessage = caught instanceof Error ? caught.message : 'Something went wrong.';
      setErrorMessage(nextMessage);
      setErrorSheetOpen(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy('');
    }
  }, []);

  const showError = useCallback((nextMessage: string) => {
    setErrorMessage(nextMessage);
    setErrorSheetOpen(true);
  }, []);

  const sheetActions = useMemo(() => ({
    busy,
    run,
    setMessage,
  }), [busy, run]);

  function openSheet(next: ToolSheet) {
    setMessage('');
    setErrorSheetOpen(false);
    setErrorMessage('');
    setActiveSheet(next);
  }

  function closeSheet() {
    setActiveSheet('none');
  }

  function closeErrorSheet() {
    setErrorSheetOpen(false);
    setErrorMessage('');
  }

  async function copySignature(kind: 'plain' | 'html') {
    if (!card) return;

    try {
      let qrDataUri: string | undefined;
      if (kind === 'html' && card.slug && session?.access_token) {
        try {
          qrDataUri = await fetchBrandedQrDataUri(card.slug, session.access_token);
        } catch {
          qrDataUri = undefined;
        }
      }

      const value = kind === 'plain'
        ? buildPlainSignature(signatureProfile)
        : buildHtmlSignature({ ...signatureProfile, qrDataUri });
      await Clipboard.setStringAsync(value);
      setCopied(kind);
      setTimeout(() => setCopied(''), 1500);
      setMessage(kind === 'plain' ? 'Plain signature copied.' : 'HTML signature copied.');
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : 'Could not copy the signature.');
    }
  }

  if (!card) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top + spacing.x2, paddingHorizontal: spacing.x5 }]}>
        <BackButton onPress={() => router.back()} />
        <Panel style={{ marginTop: spacing.x4 }}>
          <Text style={styles.panelTitle}>Card not found</Text>
          <Body>This card may have been deleted. Go back and choose another card.</Body>
          <Button onPress={() => router.replace('/(tabs)/card')}>Go to my cards</Button>
        </Panel>
      </View>
    );
  }

  const published = card.status === 'published';
  const sharedSheetProps = {
    card,
    publicUrl,
    theme,
    actions: sheetActions,
    accessToken: session?.access_token,
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.headerCopy}>
            <Eyebrow>Card tools</Eyebrow>
            <Text style={styles.title}>{card.label || card.name || 'Untitled card'}</Text>
            <Body style={styles.subtitle}>
              Wallet, widgets, NFC, and sharing extras for this card.
            </Body>
            <View style={styles.cardMetaRow}>
              <View style={[styles.themeChip, { backgroundColor: theme.backgroundColor }]}>
                <Text style={[styles.themeChipText, { color: theme.color }]}>{theme.backgroundColor}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit this card"
                onPress={() => router.push(`/edit-card?id=${card.id}`)}
                style={styles.editLink}>
                <PencilSimple size={14} color={colors.ink} weight="bold" />
                <Text style={styles.editLinkText}>Edit card</Text>
              </Pressable>
            </View>
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
          ) : !published ? (
            <Panel>
              <Text style={styles.panelTitle}>Publish your card</Text>
              <Body>Wallet passes and NFC need a live public link.</Body>
              <Button onPress={() => router.push(`/edit-card?id=${card.id}`)}>Edit and publish</Button>
            </Panel>
          ) : null}

          <Panel style={styles.toolList}>
            <ToolRow
              icon={<Wallet size={22} color={colors.ink} weight="bold" />}
              title="Wallet"
              subtitle="Add your pass to Apple or Google Wallet"
              onPress={() => openSheet('wallet')}
            />
            <ToolRow
              icon={<ContactlessPayment size={22} color={colors.ink} weight="bold" />}
              title="NFC"
              subtitle="Program tags and copy programming links"
              onPress={() => openSheet('nfc')}
            />
            <ToolRow
              icon={<SquaresFour size={22} color={colors.ink} weight="bold" />}
              title="Home screen widgets"
              subtitle="QR scan, business card, and recent connections"
              onPress={() => openSheet('widgets')}
            />
            <ToolRow
              icon={<EnvelopeSimple size={22} color={colors.ink} weight="bold" />}
              title="Email signature"
              subtitle="Copy plain text or HTML for your inbox"
              onPress={() => openSheet('signature')}
            />
            <ToolRow
              icon={<Watch size={22} color={colors.ink} weight="bold" />}
              title="Smart watch"
              subtitle="Download a QR for your watch face"
              onPress={() => openSheet('watch')}
            />
            <ToolRow
              icon={<Monitor size={22} color={colors.ink} weight="bold" />}
              title="Virtual background"
              subtitle="Meeting background with your card QR"
              onPress={() => openSheet('background')}
            />
          </Panel>
        </ScrollView>
      </View>

      <BottomSheet visible={activeSheet === 'wallet'} title="Wallet" onClose={closeSheet}>
        <WalletToolSheetContent
          {...sharedSheetProps}
          showCompany={showCompany}
          walletAvailable={walletAvailable}
          walletNote={walletNote}
          message={message}
        />
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'nfc'} title="NFC" onClose={closeSheet}>
        <NfcToolSheetContent
          {...sharedSheetProps}
          actions={sheetActions}
          message={message}
        />
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'widgets'} title="Home screen widgets" onClose={closeSheet}>
        <WidgetToolSheetContent
          {...sharedSheetProps}
          allCards={cards}
          cardPublicUrl={cardPublicUrl}
          showCompany={showCompany}
          initials={initials}
          message={message}
        />
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'signature'} title="Email signature" onClose={closeSheet}>
        <SignatureToolSheetContent
          card={card}
          publicUrl={publicUrl}
          accessToken={session?.access_token}
          signatureProfile={signatureProfile}
          initials={initials}
          showCompany={showCompany}
          copied={copied}
          copySignature={copySignature}
          message={message}
        />
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'watch'} title="Smart watch" onClose={closeSheet}>
        <WatchToolSheetContent
          {...sharedSheetProps}
          published={published}
          message={message}
        />
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'background'} title="Virtual background" onClose={closeSheet}>
        <BackgroundToolSheetContent
          {...sharedSheetProps}
          published={published}
          subtitle={subtitle}
          message={message}
        />
      </BottomSheet>

      <CardToolErrorSheet
        visible={errorSheetOpen}
        message={errorMessage}
        onClose={closeErrorSheet}
      />
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
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    marginTop: spacing.x2,
  },
  themeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.round,
  },
  themeChipText: { fontSize: 11, fontWeight: '800' },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editLinkText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
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
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  toolList: { gap: 0, paddingVertical: spacing.x1 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingVertical: spacing.x4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  toolRowPressed: { opacity: 0.72 },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCopy: { flex: 1, gap: 2 },
  toolTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  toolSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
