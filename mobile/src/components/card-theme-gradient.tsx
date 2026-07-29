import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

import { themeGradientStops } from '@/features/card/theme-colors';

type CardThemeGradientProps = {
  theme: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function CardThemeGradient({ theme, style, children }: CardThemeGradientProps) {
  const gradientId = useId().replace(/:/g, '');
  const stops = themeGradientStops(theme);

  return (
    <View style={[style, styles.container, { backgroundColor: stops[1] }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="0.48" stopColor={stops[1]} />
            <Stop offset="1" stopColor={stops[2]} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {children}
    </View>
  );
}

export function CardThemeGradientFill({ theme, style }: { theme: string; style?: StyleProp<ViewStyle> }) {
  return <CardThemeGradient theme={theme} style={[StyleSheet.absoluteFill, style]} />;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
