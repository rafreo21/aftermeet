import * as Brightness from 'expo-brightness';
import { router, useLocalSearchParams } from 'expo-router';
import { ContactlessPayment, Scan, ShareNetwork } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Body, Button, PageHeader, ScreenFrame } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import {
  isTapToShareActive,
  isTapToShareNativeReady,
  isTapToShareSupported,
  setTapToShareReadListener,
  startTapToShare,
  stopTapToShare,
  TAP_TO_SHARE_REBUILD_MESSAGE,
} from '@/features/card/nfc-hce-actions';
import { QR_LOGO } from '@/lib/widget-qr';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ShareCardScreen() {
  const { id, slug } = useLocalSearchParams<{ id?: string; slug?: string }>();
  const { card: activeCard, cards, getCardById, cardPublicUrl } = useCard();
  const card = (id ? getCardById(id) : undefined)
    || (slug ? cards.find((item) => item.slug === slug) : undefined)
    || activeCard;
  const publicUrl = cardPublicUrl(card);
  const tapSupported = isTapToShareSupported();
  const tapNativeReady = isTapToShareNativeReady();
  const [tapActive, setTapActive] = useState(false);
  const [tapMessage, setTapMessage] = useState(tapNativeReady ? '' : TAP_TO_SHARE_REBUILD_MESSAGE);

  useEffect(() => {
    let original = 0.5;
    Brightness.getBrightnessAsync().then((value) => { original = value; return Brightness.setBrightnessAsync(1); }).catch(() => {});
    return () => {
      Brightness.setBrightnessAsync(original).catch(() => {});
      void stopTapToShare();
      setTapToShareReadListener(null);
    };
  }, []);

  const toggleTapToShare = useCallback(async () => {
    if (!tapSupported) return;

    setTapMessage('');
    if (tapActive || isTapToShareActive()) {
      await stopTapToShare();
      setTapActive(false);
      setTapMessage('Tap to share turned off.');
      return;
    }

    try {
      await startTapToShare(publicUrl);
      setTapActive(true);
      setTapMessage('Ready. Ask them to hold their phone against yours.');
      setTapToShareReadListener(() => {
        setTapMessage('Card link shared by tap.');
      });
    } catch (error) {
      setTapActive(false);
      setTapMessage(error instanceof Error ? error.message : 'Could not start tap to share.');
    }
  }, [publicUrl, tapActive, tapSupported]);

  async function shareCard() {
    await Share.share({
      title: `${card.name} · AfterMeet`,
      message: `${card.name}\n${card.role}${card.company ? ` at ${card.company}` : ''}\n${publicUrl}`,
      url: publicUrl,
    });
  }

  return (
    <ScreenFrame style={styles.frame}>
      <PageHeader eyebrow="Quick Share" title="Scan to connect" titleStyle={styles.title} />
      <Body style={styles.cardLine}>
        {card.name}
        {card.role || card.company
          ? ` · ${[card.role, card.company].filter(Boolean).join(' · ')}`
          : ''}
      </Body>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.qr}>
          <QRCode
            value={publicUrl}
            size={220}
            color={colors.ink}
            backgroundColor={colors.white}
            logo={QR_LOGO}
            logoSize={48}
            logoBackgroundColor={colors.white}
            logoMargin={4}
            logoBorderRadius={12}
            ecl="H"
          />
        </View>
        {tapSupported ? (
          <View style={[styles.tapPanel, tapActive && styles.tapPanelActive]}>
            <Text style={styles.tapTitle}>{tapActive ? 'Tap to share is on' : 'Or tap phones together'}</Text>
            <Text style={styles.tapBody}>
              {tapActive
                ? 'Keep this screen open. Their phone reads your card link over NFC.'
                : 'Turn on tap to share, then hold your phone against theirs.'}
            </Text>
            {tapMessage ? <Text style={styles.tapMessage}>{tapMessage}</Text> : null}
          </View>
        ) : (
          <Text style={styles.helperInline}>On iPhone, share with the QR code or Apple Wallet pass.</Text>
        )}
      </ScrollView>
      <View style={styles.actions}>
        {tapSupported ? (
          <Button
            style={styles.actionButton}
            variant={tapActive ? 'secondary' : 'primary'}
            disabled={!tapNativeReady && !tapActive}
            onPress={() => void toggleTapToShare()}>
            <ContactlessPayment size={18} color={colors.ink} weight="bold" />
            {tapActive ? 'Stop tap to share' : 'Tap to share'}
          </Button>
        ) : null}
        <Button style={styles.actionButton} onPress={shareCard}>
          <ShareNetwork size={18} color={colors.ink} /> Share
        </Button>
        <Button
          style={styles.actionButton}
          variant="secondary"
          onPress={() => router.push('/scanner')}>
          <Scan size={18} color={colors.ink} weight="bold" /> Quick Scan
        </Button>
      </View>
      <Text style={styles.helper}>Brightness is temporarily increased while this screen is open.</Text>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, gap: spacing.x3 },
  title: { fontSize: 30, lineHeight: 32 },
  cardLine: { marginTop: -spacing.x1, color: colors.muted, textAlign: 'left' },
  scroll: { flex: 1 },
  scrollContent: {
    alignItems: 'center',
    paddingTop: spacing.x2,
    paddingBottom: spacing.x2,
    gap: spacing.x2,
  },
  qr: {
    padding: 20,
    borderRadius: radius.large,
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 25,
    elevation: 6,
  },
  tapPanel: {
    marginTop: spacing.x4,
    width: '100%',
    padding: spacing.x4,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.x2,
  },
  tapPanelActive: {
    borderColor: colors.accent,
    backgroundColor: '#eef8e8',
  },
  tapTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  tapBody: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  tapMessage: { color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  helperInline: { marginTop: spacing.x3, color: colors.muted, fontSize: 12, textAlign: 'center' },
  actions: { gap: spacing.x2 },
  actionButton: { alignSelf: 'stretch' },
  helper: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
