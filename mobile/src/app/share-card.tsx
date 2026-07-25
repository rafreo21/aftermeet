import * as Brightness from 'expo-brightness';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Copy, ShareNetwork, X } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ShareCardScreen() {
  const { card, publicUrl } = useCard();
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

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><View><Text style={styles.eyebrow}>Quick Share</Text><Text style={styles.heading}>{card.name}</Text></View><Pressable accessibilityLabel="Close sharing mode" onPress={() => router.back()} style={styles.close}><X size={22} color={colors.ink} /></Pressable></View>
    <View style={styles.stage}>
      <View style={styles.qr}><QRCode value={publicUrl} size={246} color={colors.ink} backgroundColor={colors.white} /></View>
      <Text style={styles.title}>Scan to connect</Text>
      <Text style={styles.subtitle}>{card.role}{card.company ? ` · ${card.company}` : ''}</Text>
      <Text numberOfLines={1} style={styles.url}>{publicUrl}</Text>
    </View>
    <View style={styles.actions}><Button style={{ flex: 1 }} onPress={copy}>{copied ? <Check size={18} color={colors.ink} /> : <Copy size={18} color={colors.ink} />}{copied ? 'Copied' : 'Copy link'}</Button><Button style={{ flex: 1 }} variant="secondary" onPress={async () => { await Share.share({ title: `${card.name} · AfterMeet`, message: `${card.name}\n${card.role}${card.company ? ` at ${card.company}` : ''}\n${publicUrl}`, url: publicUrl }); }}><ShareNetwork size={18} color={colors.ink} /> Share</Button></View>
    <Text style={styles.helper}>Brightness is temporarily increased while this screen is open.</Text>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.x5, backgroundColor: colors.canvas },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  heading: { marginTop: 5, color: colors.ink, fontSize: 24, fontWeight: '800' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: colors.surface },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qr: { padding: 22, borderRadius: radius.large, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 25, elevation: 6 },
  title: { marginTop: spacing.x6, color: colors.ink, fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: spacing.x2, color: colors.muted, textAlign: 'center' },
  url: { marginTop: spacing.x4, maxWidth: '85%', color: colors.inkSoft, fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.x2 },
  helper: { marginTop: spacing.x3, color: colors.muted, fontSize: 11, textAlign: 'center' },
});
