import { StyleSheet, View } from 'react-native';

import { BrandedQrCode, type QrShareMode } from '@/components/branded-qr-code';
import type { MobileCard } from '@/features/card/types';

type BrandedQrPreviewProps = {
  cardUrl: string;
  card?: MobileCard;
  mode?: QrShareMode;
  size?: number;
};

export function BrandedQrPreview({
  cardUrl,
  card,
  mode = 'online',
  size = 120,
}: BrandedQrPreviewProps) {
  return (
    <View style={styles.wrap}>
      <BrandedQrCode card={card} cardUrl={cardUrl} mode={mode} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
