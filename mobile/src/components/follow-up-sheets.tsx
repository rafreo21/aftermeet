import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui';
import type { FollowUpSort } from '@/features/follow-ups/follow-up-list';
import { spacing } from '@/theme/tokens';

type FollowUpSortSheetProps = {
  visible: boolean;
  sort: FollowUpSort;
  onClose: () => void;
  onSelect: (sort: FollowUpSort) => void;
};

export function FollowUpSortSheet({
  visible,
  sort,
  onClose,
  onSelect,
}: FollowUpSortSheetProps) {
  return (
    <BottomSheet visible={visible} title="Sort by" onClose={onClose}>
      <View style={styles.sortOptions}>
        <Button
          variant={sort === 'urgency' ? 'primary' : 'secondary'}
          onPress={() => {
            onSelect('urgency');
            onClose();
          }}>
          By urgency
        </Button>
        <Button
          variant={sort === 'recent' ? 'primary' : 'secondary'}
          onPress={() => {
            onSelect('recent');
            onClose();
          }}>
          Most recent
        </Button>
        <Button
          variant={sort === 'az' ? 'primary' : 'secondary'}
          onPress={() => {
            onSelect('az');
            onClose();
          }}>
          Name A–Z
        </Button>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sortOptions: { gap: spacing.x2 },
});
