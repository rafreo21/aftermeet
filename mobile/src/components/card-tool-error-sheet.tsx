import { WarningCircle } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Body } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

type CardToolErrorSheetProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export function CardToolErrorSheet({ visible, message, onClose }: CardToolErrorSheetProps) {
  const trimmed = message.trim();

  return (
    <BottomSheet
      visible={visible && Boolean(trimmed)}
      title="Something went wrong"
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
        <WarningCircle size={34} color={colors.danger} weight="fill" />
      </View>
      <Body style={styles.message}>{trimmed || 'Something went wrong.'}</Body>
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
    backgroundColor: '#FDECEA',
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
