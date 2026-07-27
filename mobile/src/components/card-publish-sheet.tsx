import { CheckCircle, WarningCircle } from 'phosphor-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Body, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

type CardPublishSheetProps = {
  visible: boolean;
  variant: 'success' | 'error';
  title: string;
  message: string;
  detail?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onClose: () => void;
  loading?: boolean;
};

export function CardPublishSheet({
  visible,
  variant,
  title,
  message,
  detail,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onClose,
  loading,
}: CardPublishSheetProps) {
  const isSuccess = variant === 'success';
  const Icon = isSuccess ? CheckCircle : WarningCircle;

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <>
          {secondaryLabel && onSecondary ? (
            <Button variant="secondary" onPress={onSecondary} disabled={loading}>
              {secondaryLabel}
            </Button>
          ) : null}
          <Button onPress={onPrimary} loading={loading}>
            {primaryLabel || (isSuccess ? 'Done' : 'Try again')}
          </Button>
        </>
      }>
      <View style={[styles.iconWrap, isSuccess ? styles.iconSuccess : styles.iconError]}>
        <Icon size={34} color={isSuccess ? colors.ink : colors.danger} weight="fill" />
      </View>
      <Body style={styles.message}>{message}</Body>
      {detail ? (
        <View style={styles.detailBox}>
          <Text style={styles.detailText}>{detail}</Text>
        </View>
      ) : null}
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
  },
  iconSuccess: { backgroundColor: '#E2F6D5' },
  iconError: { backgroundColor: '#FDECEA' },
  message: { textAlign: 'center' },
  detailBox: {
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
  },
  detailText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
