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

/** Side-by-side panel: copy left, branded QR right, scan line bottom-left. */
export function VirtualBackgroundPanelPreview({
  name,
  subtitle,
  cardUrl,
  slug,
  accessToken,
  panelWidth = 240,
}: VirtualBackgroundPanelPreviewProps) {
  const scale = panelWidth / 360;
  const pad = Math.round(28 * scale);
  const qrSize = Math.max(56, Math.round(120 * scale));
  const panelHeight = Math.round(168 * scale);
  const nameFontSize = Math.max(12, Math.round(28 * scale));
  const subtitleFontSize = Math.max(10, Math.round(18 * scale));
  const scanFontSize = Math.max(9, Math.round(14 * scale));

  return (
    <View style={[styles.panel, { width: panelWidth, minHeight: panelHeight, padding: pad }]}>
      <View style={styles.row}>
        <View style={[styles.copy, { minHeight: qrSize }]}>
          <View style={styles.heading}>
            <Text style={[styles.name, { fontSize: nameFontSize }]} numberOfLines={2}>
              {name}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { fontSize: subtitleFontSize }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.scanLabel, { fontSize: scanFontSize }]}>
            Scan to save my contact
          </Text>
        </View>
        <BrandedQrPreview
          cardUrl={cardUrl}
          slug={slug}
          accessToken={accessToken}
          size={qrSize}
          style={styles.qr}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  heading: {
    gap: 2,
  },
  name: {
    color: colors.ink,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
  },
  qr: {
    borderRadius: 10,
    flexShrink: 0,
  },
  scanLabel: {
    color: colors.muted,
    fontWeight: '600',
  },
});
