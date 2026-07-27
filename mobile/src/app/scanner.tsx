import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton, Button } from '@/components/ui';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

function parseCardSlug(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/c\/([^/?#]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const insets = useAppInsets();

  async function scanned(result: BarcodeScanningResult) {
    if (locked) return;
    setLocked(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const slug = parseCardSlug(result.data);
    if (slug) {
      router.replace({ pathname: '/capture/new', params: { slug } });
      return;
    }
    if (await Linking.canOpenURL(result.data)) await Linking.openURL(result.data);
    else setLocked(false);
  }

  if (!permission?.granted) {
    return (
      <View style={[styles.permission, { paddingTop: insets.top + spacing.x5, paddingBottom: insets.bottom + spacing.x5 }]}>
        <BackButton />
        <Text style={styles.permissionTitle}>Camera access is needed to scan a card.</Text>
        <Button onPress={async () => { await requestPermission(); }}>Allow camera</Button>
        <Button variant="ghost" onPress={() => router.back()}>Not now</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked ? undefined : scanned}
      />
      <View style={[styles.overlay, { paddingTop: insets.top + spacing.x5, paddingBottom: insets.bottom + spacing.x5 }]}>
        <View style={styles.top}>
          <BackButton style={styles.backOnDark} />
          <Text style={styles.title}>Scan an AfterMeet card</Text>
        </View>
        <View style={styles.frame}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>
        <Text style={styles.helper}>Position the QR code inside the frame.</Text>
      </View>
    </View>
  );
}

const corner = { position: 'absolute' as const, width: 38, height: 38, borderColor: colors.accent };
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, paddingHorizontal: spacing.x5, backgroundColor: 'rgba(0,0,0,.28)' },
  top: { gap: spacing.x3 },
  title: { color: colors.white, fontSize: 20, fontWeight: '800' },
  backOnDark: { backgroundColor: colors.white },
  frame: { width: 270, height: 270, alignSelf: 'center', marginTop: '35%' },
  cornerTL: { ...corner, top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 12 },
  cornerTR: { ...corner, top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 12 },
  cornerBL: { ...corner, bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 12 },
  cornerBR: { ...corner, bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 12 },
  helper: { marginTop: spacing.x5, color: colors.white, textAlign: 'center', fontWeight: '700' },
  permission: { flex: 1, paddingHorizontal: spacing.x6, justifyContent: 'center', gap: spacing.x4, backgroundColor: colors.canvas },
  permissionTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
});
