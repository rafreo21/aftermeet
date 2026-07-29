import { StyleSheet, View } from 'react-native';

import { BrandedQrCode } from '@/components/branded-qr-code';
import type { MobileCard } from '@/features/card/types';

type BrandedQrPreviewProps = {
  card: MobileCard;
  cardUrl: string;
  size?: number;
  slug?: string;
  accessToken?: string;
};

export function BrandedQrPreview({
  card,
  cardUrl,
  size = 120,
}: BrandedQrPreviewProps) {
  return (
    <View style={styles.wrap}>
      <BrandedQrCode card={card} cardUrl={cardUrl} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
