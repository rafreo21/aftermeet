import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { fetchBrandedQrDataUri } from '@/lib/branded-qr-client';
import { QR_LOGO } from '@/lib/widget-qr';
import { colors } from '@/theme/tokens';

type BrandedQrPreviewProps = {
  cardUrl: string;
  slug?: string;
  accessToken?: string;
  size?: number;
  style?: ViewStyle;
};

function LocalBrandedQr({ value, size }: { value: string; size: number }) {
  if (!value.trim()) {
    return <Text style={styles.placeholder}>QR</Text>;
  }

  const logoSize = Math.max(14, Math.round(size * 0.24));
  const badgeSize = logoSize + 8;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <QRCode
        value={value}
        size={size}
        color="#163300"
        backgroundColor="#FFFFFF"
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
        <Image source={QR_LOGO} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />
      </View>
    </View>
  );
}

export function BrandedQrPreview({
  cardUrl,
  slug,
  accessToken,
  size = 120,
  style,
}: BrandedQrPreviewProps) {
  const [remoteUri, setRemoteUri] = useState<string | null>(null);

  useEffect(() => {
    if (!slug?.trim() || !accessToken?.trim()) {
      setRemoteUri(null);
      return;
    }

    let cancelled = false;
    void fetchBrandedQrDataUri(slug, accessToken, Math.max(320, size * 4))
      .then((uri) => {
        if (!cancelled) setRemoteUri(uri);
      })
      .catch(() => {
        if (!cancelled) setRemoteUri(null);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, size, slug]);

  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      {remoteUri ? (
        <Image source={{ uri: remoteUri }} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <LocalBrandedQr value={cardUrl} size={size} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  frame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  logoBadge: {
    position: 'absolute',
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
