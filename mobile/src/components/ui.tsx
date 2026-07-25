import { Children, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme/tokens';

export function Screen({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const content = <View style={[styles.screenContent, style]}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Body({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Panel({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ children, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.ink : colors.muted} /> : (
        <View style={styles.buttonContent}>{Children.map(children, (child) =>
          typeof child === 'string' || typeof child === 'number'
            ? <Text style={[styles.buttonText, variant !== 'primary' && styles.buttonTextSecondary]}>{child}</Text>
            : child
        )}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1 },
  screenContent: { flex: 1, paddingHorizontal: spacing.x5, paddingBottom: 120, gap: spacing.x5 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 40, lineHeight: 42, fontWeight: '700', letterSpacing: -1.5 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  panel: { padding: spacing.x5, borderRadius: radius.medium, backgroundColor: colors.surface },
  button: { minHeight: 48, paddingHorizontal: spacing.x5, alignItems: 'center', justifyContent: 'center', borderRadius: radius.small, backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surfaceMuted },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  buttonTextSecondary: { color: colors.ink },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.x2 },
});
