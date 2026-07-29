import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CardThemeGradientFill } from '@/components/card-theme-gradient';
import { themeWalletBackgroundColor } from '@/features/card/theme-colors';
import { colors, radius } from '@/theme/tokens';

export function WalletPreviewBackground({
  theme,
  style,
  children,
}: {
  theme: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const backgroundColor = themeWalletBackgroundColor(theme);

  return (
    <View style={[styles.walletFrame, { backgroundColor, borderColor: `${backgroundColor}55` }, style]}>
      {children}
    </View>
  );
}

/** Matches the card cover gradient (highlight → base → shadow). */
export function VirtualBackgroundPreviewBackground({
  theme,
  style,
  children,
}: {
  theme: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.virtualFrame, style]}>
      <CardThemeGradientFill theme={theme} />
      <View style={styles.virtualContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  walletFrame: {
    borderRadius: radius.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  virtualFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
  },
  virtualContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 12,
    paddingRight: 12,
  },
});
