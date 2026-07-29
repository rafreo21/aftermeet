import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { MobileCard } from '@/features/card/types';
import { buildOfflineQrPayload } from '@/lib/offline-qr-payload';
import { QR_LOGO } from '@/lib/widget-qr';
import { colors } from '@/theme/tokens';

export type QrShareMode = 'online' | 'offline';

type BrandedQrCodeProps = {
  /** Card page URL — default QR payload for online visitor flow. */
  cardUrl?: string;
  value?: string;
  /** Required only for offline contact QR mode. */
  card?: MobileCard;
  mode?: QrShareMode;
  size?: number;
  style?: ViewStyle;
  color?: string;
  backgroundColor?: string;
};

function resolvePayload({ value, card, cardUrl, mode = 'online' }: BrandedQrCodeProps) {
  if (mode === 'offline') {
    if (card && cardUrl?.trim()) {
      return buildOfflineQrPayload(card, cardUrl.trim());
    }
    const fallback = value?.trim() ?? '';
    return fallback ? { payload: fallback, tier: 'minimal' as const, ecl: 'M' as const } : null;
  }

  const payload = cardUrl?.trim() || value?.trim() || '';
  return payload ? { payload, tier: 'full' as const, ecl: 'H' as const } : null;
}

export function BrandedQrCode({
  value,
  card,
  cardUrl,
  mode = 'online',
  size = 120,
  style,
  color = colors.ink,
  backgroundColor = colors.white,
}: BrandedQrCodeProps) {
  const resolved = useMemo(
    () => resolvePayload({ value, card, cardUrl, mode }),
    [value, card, cardUrl, mode],
  );
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    setRenderError('');
  }, [resolved?.payload, resolved?.ecl]);

  if (!resolved?.payload) {
    return (
      <View style={[styles.frame, { width: size, height: size }, style]}>
        <Text style={styles.placeholder}>QR</Text>
      </View>
    );
  }

  if (renderError) {
    return (
      <View style={[styles.frame, styles.errorFrame, { width: size, height: size }, style]}>
        <Text style={styles.errorText}>{renderError}</Text>
      </View>
    );
  }

  const logoSize = Math.max(14, Math.round(size * 0.22));
  const badgeSize = logoSize + 8;

  return (
    <View style={[styles.frame, { width: size, height: size }, style]}>
      <QRCode
        key={`${resolved.payload}:${resolved.ecl}`}
        value={resolved.payload}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
        ecl={resolved.ecl}
        onError={(error) => {
          setRenderError(error instanceof Error ? error.message : 'Could not render this QR code.');
        }}
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
  errorFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  errorText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});
