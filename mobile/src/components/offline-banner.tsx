import { WifiSlash } from 'phosphor-react-native';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useIsOnline } from '@/lib/connectivity';
import { colors, radius, spacing } from '@/theme/tokens';

export function OfflineBanner({
  message = "You're offline — changes save on this device and sync automatically.",
  style,
}: {
  message?: string;
  style?: ViewStyle;
}) {
  const online = useIsOnline();
  if (online) return null;

  return (
    <View style={[styles.banner, style]}>
      <WifiSlash size={14} color={colors.muted} weight="bold" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
  },
  text: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: '700' },
});
