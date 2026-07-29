import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  findNodeHandle,
  useWindowDimensions,
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

export function BottomSheet({ visible, title, onClose, footer, children }: BottomSheetProps) {
  const insets = useAppInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const sheetBodyRef = useRef<View>(null);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  // Lift the whole sheet above the keyboard. Modal windows on Android do not
  // resize with softwareKeyboardLayoutMode, so padding must live on this root.
  const lift = Math.max(0, keyboardHeight);
  const sheetMaxHeight = Math.min(
    windowHeight * 0.82,
    Math.max(280, windowHeight - lift - Math.max(insets.top, spacing.x4) - spacing.x4),
  );
  const sheetPaddingBottom = Math.max(insets.bottom, spacing.x4);

  useEffect(() => {
    if (!visible || lift <= 0) return;

    const timer = setTimeout(() => {
      const focused = TextInput.State?.currentlyFocusedInput?.();
      const scrollNode = findNodeHandle(scrollRef.current);
      if (!focused || !scrollNode || !sheetBodyRef.current) return;

      focused.measureLayout(
        scrollNode,
        (_x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - spacing.x6),
            animated: true,
          });
        },
        () => {
          scrollRef.current?.scrollToEnd({ animated: true });
        },
      );
    }, Platform.OS === 'ios' ? 60 : 120);

    return () => clearTimeout(timer);
  }, [lift, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: lift }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              // Force a bounded height while the keyboard is open so ScrollView can scroll.
              height: lift > 0 ? sheetMaxHeight : undefined,
              paddingBottom: sheetPaddingBottom,
            },
          ]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <View ref={sheetBodyRef} style={styles.bodyWrap}>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {children}
            </ScrollView>
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
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
    ...StyleSheet.absoluteFillObject,
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
  bodyWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  scroll: {
    flexGrow: 1,
  },
  body: {
    gap: spacing.x4,
    paddingBottom: spacing.x2,
    flexGrow: 1,
  },
  footer: {
    marginTop: spacing.x4,
    paddingTop: spacing.x2,
    gap: spacing.x2,
  },
});
