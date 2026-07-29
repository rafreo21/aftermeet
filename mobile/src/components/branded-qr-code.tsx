import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { QR_LOGO } from '@/lib/widget-qr';
import { colors } from '@/theme/tokens';

type BrandedQrCodeProps = {
  value: string;
  size?: number;
  style?: ViewStyle;
  color?: string;
  backgroundColor?: string;
};

export function BrandedQrCode({
  value,
  size = 120,
  style,
  color = colors.ink,
  backgroundColor = colors.white,
}: BrandedQrCodeProps) {
  if (!value.trim()) {
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
        value={value}
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
