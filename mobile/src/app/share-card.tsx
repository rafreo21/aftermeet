import * as Brightness from 'expo-brightness';
import { router, useLocalSearchParams } from 'expo-router';
import { Scan, ShareNetwork } from 'phosphor-react-native';
import { useEffect } from 'react';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, PageHeader, ScreenFrame } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import { QR_LOGO } from '@/lib/widget-qr';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ShareCardScreen() {
  const { id, slug } = useLocalSearchParams<{ id?: string; slug?: string }>();
  const { card: activeCard, cards, getCardById, cardPublicUrl } = useCard();
  const card = (id ? getCardById(id) : undefined)
    || (slug ? cards.find((item) => item.slug === slug) : undefined)
    || activeCard;
  const publicUrl = cardPublicUrl(card);

  useEffect(() => {
    let original = 0.5;
    Brightness.getBrightnessAsync().then((value) => { original = value; return Brightness.setBrightnessAsync(1); }).catch(() => {});
    return () => { Brightness.setBrightnessAsync(original).catch(() => {}); };
  }, []);

  async function shareCard() {
    await Share.share({
      title: `${card.name} · AfterMeet`,
      message: `${card.name}\n${card.role}${card.company ? ` at ${card.company}` : ''}\n${publicUrl}`,
      url: publicUrl,
    });
  }

  return (
    <ScreenFrame style={styles.frame}>
      <PageHeader eyebrow="Quick Share" title={card.name} titleStyle={styles.heading} />
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
        <Text style={styles.title}>Scan to connect</Text>
        <Text style={styles.subtitle}>{card.role}{card.company ? ` · ${card.company}` : ''}</Text>
        <Text numberOfLines={1} style={styles.url}>{publicUrl}</Text>
      </ScrollView>
      <View style={styles.actions}>
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
  frame: { flex: 1, gap: spacing.x4 },
  heading: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8 },
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
  title: { marginTop: spacing.x2, color: colors.ink, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center' },
  url: { marginTop: spacing.x2, maxWidth: '85%', color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  actions: { gap: spacing.x2 },
  actionButton: { alignSelf: 'stretch' },
  helper: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
