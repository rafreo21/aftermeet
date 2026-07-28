import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

type GreenHeroCardProps = {
  icon: ReactNode;
  title: string;
  copy: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function GreenHeroCard({
  icon,
  title,
  copy,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: GreenHeroCardProps) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroIcon}>{icon}</View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Body style={styles.heroCopy}>{copy}</Body>
      {primaryLabel && onPrimary ? <Button onPress={onPrimary}>{primaryLabel}</Button> : null}
      {secondaryLabel && onSecondary ? (
        <Button variant="secondary" onPress={onSecondary}>{secondaryLabel}</Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.x3,
    padding: spacing.x5,
    borderRadius: radius.large,
    backgroundColor: colors.ink,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(135, 234, 92, 0.18)',
  },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', lineHeight: 28 },
  heroCopy: { color: '#C5D3BF', lineHeight: 22 },
});
