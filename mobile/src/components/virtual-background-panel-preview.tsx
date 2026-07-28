import { StyleSheet, Text, View } from 'react-native';

import { BrandedQrPreview } from '@/components/branded-qr-preview';
import { colors } from '@/theme/tokens';

type VirtualBackgroundPanelPreviewProps = {
  name: string;
  subtitle: string;
  cardUrl: string;
  slug?: string;
  accessToken?: string;
  panelWidth?: number;
};

/** Matches export panel proportions: left text, centered QR, centered scan label. */
export function VirtualBackgroundPanelPreview({
  name,
  subtitle,
  cardUrl,
  slug,
  accessToken,
  panelWidth = 228,
}: VirtualBackgroundPanelPreviewProps) {
  const scale = panelWidth / 380;
  const pad = Math.round(28 * scale);
  const qrSize = Math.round(220 * scale);
  const textGapBeforeQr = Math.round(20 * scale);
  const scanGapAfterQr = Math.round(14 * scale);
  const nameFontSize = Math.max(12, Math.round(30 * scale));
  const subtitleFontSize = Math.max(10, Math.round(18 * scale));
  const scanFontSize = Math.max(9, Math.round(16 * scale));

  return (
    <View style={[styles.panel, { width: panelWidth, padding: pad }]}>
      <Text style={[styles.name, { fontSize: nameFontSize }]} numberOfLines={2}>
        {name}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { fontSize: subtitleFontSize }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      <View style={[styles.qrRow, { marginTop: textGapBeforeQr }]}>
        <BrandedQrPreview
          cardUrl={cardUrl}
          slug={slug}
          accessToken={accessToken}
          size={qrSize}
          style={styles.qr}
        />
      </View>
      <Text
        style={[
          styles.scanLabel,
          { fontSize: scanFontSize, marginTop: scanGapAfterQr },
        ]}>
        Scan to save my contact
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  name: {
    color: colors.ink,
    fontWeight: '800',
    textAlign: 'left',
  },
  subtitle: {
    color: colors.muted,
    marginTop: 2,
    textAlign: 'left',
  },
  qrRow: {
    width: '100%',
    alignItems: 'center',
  },
  qr: {
    borderRadius: 10,
  },
  scanLabel: {
    color: colors.muted,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
});
