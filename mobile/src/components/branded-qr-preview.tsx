import { StyleSheet, View, type ViewStyle } from 'react-native';

import { BrandedQrCode } from '@/components/branded-qr-code';
import { colors } from '@/theme/tokens';

type BrandedQrPreviewProps = {
  cardUrl: string;
  slug?: string;
  accessToken?: string;
  size?: number;
  style?: ViewStyle;
};

export function BrandedQrPreview({
  cardUrl,
  size = 120,
  style,
}: BrandedQrPreviewProps) {
  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      <BrandedQrCode value={cardUrl} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderRadius: 12,
  },
});
