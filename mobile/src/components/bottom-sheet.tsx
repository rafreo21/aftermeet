import type { PropsWithChildren, ReactNode } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

type BottomSheetProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}>;

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.82;

export function BottomSheet({ visible, title, onClose, footer, children }: BottomSheetProps) {
  const insets = useAppInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={styles.backdrop} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={styles.keyboard}
          pointerEvents="box-none">
          <View
            style={[
              styles.sheet,
              {
                maxHeight: SHEET_MAX_HEIGHT,
                paddingBottom: Math.max(insets.bottom, spacing.x4),
              },
            ]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(22, 51, 0, 0.48)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  keyboard: {
    width: '100%',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  sheet: {
    width: '100%',
    paddingTop: spacing.x3,
    paddingHorizontal: spacing.x5,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    marginBottom: spacing.x4,
    borderRadius: radius.round,
    backgroundColor: colors.line,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.x4,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  close: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  scroll: { flexGrow: 0 },
  body: { gap: spacing.x4, paddingBottom: spacing.x2 },
  footer: {
    marginTop: spacing.x4,
    paddingTop: spacing.x2,
    gap: spacing.x2,
  },
});
