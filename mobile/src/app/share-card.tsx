import * as Brightness from 'expo-brightness';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Check, Copy, ShareNetwork } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams } from 'expo-router';

import { Button, PageHeader, ScreenFrame } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ShareCardScreen() {
  const { id, slug } = useLocalSearchParams<{ id?: string; slug?: string }>();
  const { card: activeCard, cards, getCardById, cardPublicUrl } = useCard();
  const card = (id ? getCardById(id) : undefined)
    || (slug ? cards.find((item) => item.slug === slug) : undefined)
    || activeCard;
  const publicUrl = cardPublicUrl(card);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let original = 0.5;
    Brightness.getBrightnessAsync().then((value) => { original = value; return Brightness.setBrightnessAsync(1); }).catch(() => {});
    return () => { Brightness.setBrightnessAsync(original).catch(() => {}); };
  }, []);

  async function copy() {
    await Clipboard.setStringAsync(publicUrl);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <ScreenFrame style={styles.frame}>
      <PageHeader eyebrow="Quick Share" title={card.name} titleStyle={styles.heading} />
      <View style={styles.stage}>
        <View style={styles.qr}>
          <QRCode value={publicUrl} size={246} color={colors.ink} backgroundColor={colors.white} />
        </View>
        <Text style={styles.title}>Scan to connect</Text>
        <Text style={styles.subtitle}>{card.role}{card.company ? ` · ${card.company}` : ''}</Text>
        <Text numberOfLines={1} style={styles.url}>{publicUrl}</Text>
      </View>
      <View style={styles.actions}>
        <Button style={{ flex: 1 }} onPress={copy}>
          {copied ? <Check size={18} color={colors.ink} /> : <Copy size={18} color={colors.ink} />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button
          style={{ flex: 1 }}
          variant="secondary"
          onPress={async () => {
            await Share.share({
              title: `${card.name} · AfterMeet`,
              message: `${card.name}\n${card.role}${card.company ? ` at ${card.company}` : ''}\n${publicUrl}`,
              url: publicUrl,
            });
          }}>
          <ShareNetwork size={18} color={colors.ink} /> Share
        </Button>
      </View>
      <Text style={styles.helper}>Brightness is temporarily increased while this screen is open.</Text>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  frame: { gap: spacing.x5 },
  heading: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qr: { padding: 22, borderRadius: radius.large, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 25, elevation: 6 },
  title: { marginTop: spacing.x6, color: colors.ink, fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: spacing.x2, color: colors.muted, textAlign: 'center' },
  url: { marginTop: spacing.x4, maxWidth: '85%', color: colors.inkSoft, fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.x2 },
  helper: { marginTop: spacing.x3, color: colors.muted, fontSize: 11, textAlign: 'center' },
});
