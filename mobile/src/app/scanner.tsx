import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { QrCode } from 'phosphor-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton, Body, Button, Eyebrow } from '@/components/ui';
import { GreenHeroCard } from '@/components/green-hero-card';
import { ScanShareSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { connectionFromScannedSlug } from '@/features/connections/connections-api';
import { setAuthReturnPath } from '@/features/encounters/capture-draft';
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
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const insets = useAppInsets();

  async function openScannedCard(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!session?.access_token) {
      await setAuthReturnPath(`/connections/scan/${encodeURIComponent(normalized)}`);
      router.replace('/auth');
      return;
    }

    setLinking(true);
    setError('');
    try {
      const connection = await connectionFromScannedSlug(session.access_token, normalized);
      if (connection) {
        router.replace(`/connections/${encodeURIComponent(connection.id)}`);
        return;
      }
      setError('This card could not be added to your connections.');
      setLocked(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open this card.');
      setLocked(false);
    } finally {
      setLinking(false);
    }
  }

  async function scanned(result: BarcodeScanningResult) {
    if (locked || linking) return;
    setLocked(true);
    setError('');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const slug = parseCardSlug(result.data);
    if (slug) {
      await openScannedCard(slug);
      return;
    }
    if (await Linking.canOpenURL(result.data)) await Linking.openURL(result.data);
    else setLocked(false);
  }

  if (!session) {
    return (
      <View style={[styles.previewSafe, { paddingTop: insets.top + spacing.x2 }]}>
        <ScrollView
          contentContainerStyle={[styles.previewContent, { paddingBottom: insets.bottom + spacing.x6 }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.previewHeader}>
            <BackButton onPress={() => router.back()} />
            <View style={styles.headerCopy}>
              <Eyebrow>Scan</Eyebrow>
              <Text style={styles.previewTitle}>Add cards to your network</Text>
              <Body>Scan someone’s AfterMeet QR code to save their card and open their connection.</Body>
            </View>
          </View>
          <GreenHeroCard
            icon={<QrCode size={28} color={colors.white} weight="bold" />}
            title="Sign in to scan cards"
            copy="Save cards you scan and keep everyone you meet in one place."
            primaryLabel="Sign in"
            onPrimary={() => router.push('/auth')}
          />
        </ScrollView>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.previewSafe, { paddingTop: insets.top + spacing.x2, paddingHorizontal: spacing.x5 }]}>
        <BackButton />
        <ScanShareSkeleton />
      </View>
    );
  }

  if (!permission.granted) {
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
        onBarcodeScanned={locked || linking ? undefined : scanned}
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
        <Text style={styles.helper}>
          {linking ? 'Adding to your connections…' : 'Position the QR code inside the frame.'}
        </Text>
        {linking ? <ActivityIndicator color={colors.white} style={styles.spinner} /> : null}
        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant="ghost" onPress={() => { setLocked(false); setError(''); }}>Try again</Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const corner = { position: 'absolute' as const, width: 38, height: 38, borderColor: colors.accent };
const styles = StyleSheet.create({
  previewSafe: { flex: 1, backgroundColor: colors.canvas },
  previewContent: { paddingHorizontal: spacing.x5, gap: spacing.x3, paddingTop: spacing.x2 },
  previewHeader: { gap: spacing.x3 },
  headerCopy: { gap: spacing.x2 },
  previewTitle: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
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
  spinner: { marginTop: spacing.x4 },
  errorWrap: { marginTop: spacing.x4, gap: spacing.x2, alignItems: 'center' },
  errorText: { color: colors.white, textAlign: 'center', fontWeight: '600' },
  permission: { flex: 1, paddingHorizontal: spacing.x6, justifyContent: 'center', gap: spacing.x4, backgroundColor: colors.canvas },
  permissionTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
});
