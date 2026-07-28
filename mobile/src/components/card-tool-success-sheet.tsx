import { CheckCircle } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Body } from '@/components/ui';
import { colors, radius } from '@/theme/tokens';

type CardToolSuccessSheetProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export function CardToolSuccessSheet({ visible, message, onClose }: CardToolSuccessSheetProps) {
  const trimmed = message.trim();

  return (
    <BottomSheet
      visible={visible && Boolean(trimmed)}
      title="Done"
      onClose={onClose}
      footer={
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.okButton, pressed && styles.okButtonPressed]}>
          <Text style={styles.okLabel}>OK</Text>
        </Pressable>
      }>
      <View style={styles.iconWrap}>
        <CheckCircle size={34} color={colors.ink} weight="fill" />
      </View>
      <Body style={styles.message}>{trimmed || 'All set.'}</Body>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  message: { textAlign: 'center' },
  okButton: {
    minHeight: 48,
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  okButtonPressed: { opacity: 0.86 },
  okLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
});
