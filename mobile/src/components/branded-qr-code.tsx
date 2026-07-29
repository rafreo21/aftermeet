import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { MobileCard } from '@/features/card/types';
import { buildMobileContactQrPayload } from '@/lib/contact-qr-payload';
import { QR_LOGO } from '@/lib/widget-qr';
import { colors } from '@/theme/tokens';

type BrandedQrCodeProps = {
  /** @deprecated Prefer card + cardUrl for offline-capable contact QRs. */
  value?: string;
  card?: MobileCard;
  cardUrl?: string;
  size?: number;
  style?: ViewStyle;
  color?: string;
  backgroundColor?: string;
};

function resolvePayload({ value, card, cardUrl }: BrandedQrCodeProps) {
  if (card && cardUrl?.trim()) {
    return buildMobileContactQrPayload(card, cardUrl.trim());
  }
  return value?.trim() ?? '';
}

export function BrandedQrCode({
  value,
  card,
  cardUrl,
  size = 120,
  style,
  color = colors.ink,
  backgroundColor = colors.white,
}: BrandedQrCodeProps) {
  const payload = resolvePayload({ value, card, cardUrl });

  if (!payload) {
    return (
      <View style={[styles.frame, { width: size, height: size }, style]}>
        <Text style={styles.placeholder}>QR</Text>
      </View>
    );
  }

  const logoSize = Math.max(14, Math.round(size * 0.22));
  const badgeSize = logoSize + 8;

  return (
    <View style={[styles.frame, { width: size, height: size }, style]}>
      <QRCode
        value={payload}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
        ecl="H"
      />
      <View
        pointerEvents="none"
        style={[
          styles.logoBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: Math.round(badgeSize * 0.22),
            left: (size - badgeSize) / 2,
            top: (size - badgeSize) / 2,
          },
        ]}>
        <Image
          source={QR_LOGO}
          style={{ width: logoSize, height: logoSize }}
          contentFit="contain"
          accessibilityLabel="AfterMeet"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  logoBadge: {
    position: 'absolute',
    zIndex: 2,
    elevation: 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
});
