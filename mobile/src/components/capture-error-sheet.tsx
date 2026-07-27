import { WarningCircle } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Body } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

type CaptureErrorSheetProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export function CaptureErrorSheet({ visible, message, onClose }: CaptureErrorSheetProps) {
  const open = visible && Boolean(message.trim());
  if (!open) return null;

  return (
    <BottomSheet
      visible={open}
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
      <Body style={styles.message}>{message}</Body>
      <Text style={styles.hint}>Fix the issue and try again. Your capture progress is still saved.</Text>
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
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
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
