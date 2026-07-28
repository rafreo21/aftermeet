import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { FollowUpCell } from '@/components/follow-up-cell';
import { Button } from '@/components/ui';
import type { FollowUpItem } from '@/features/follow-ups/follow-up-api';
import { colors, radius, spacing } from '@/theme/tokens';

type FollowUpsSheetProps = {
  visible: boolean;
  title?: string;
  items: FollowUpItem[];
  onClose: () => void;
  onPressItem: (item: FollowUpItem) => void;
  onCompleteItem: (item: FollowUpItem) => void;
  completingId?: string | null;
};

type SortMode = 'urgency' | 'recent';

export function FollowUpsSheet({
  visible,
  title = 'Follow-ups',
  items,
  onClose,
  onPressItem,
  onCompleteItem,
  completingId,
}: FollowUpsSheetProps) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('urgency');
  const showTools = items.length > 10;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let next = items;
    if (normalized) {
      next = next.filter((item) => (
        item.personName.toLowerCase().includes(normalized)
        || item.title.toLowerCase().includes(normalized)
        || item.encounterTitle.toLowerCase().includes(normalized)
      ));
    }
    if (sortMode === 'recent') {
      next = [...next].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    }
    return next;
  }, [items, query, sortMode]);

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {showTools ? (
        <View style={styles.tools}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search follow-ups"
            placeholderTextColor={colors.muted}
            style={styles.search}
          />
          <View style={styles.sortRow}>
            <Button
              variant={sortMode === 'urgency' ? 'primary' : 'secondary'}
              onPress={() => setSortMode('urgency')}>
              By urgency
            </Button>
            <Button
              variant={sortMode === 'recent' ? 'primary' : 'secondary'}
              onPress={() => setSortMode('recent')}>
              Most recent
            </Button>
          </View>
        </View>
      ) : null}

      {filtered.length ? (
        <View style={styles.list}>
          {filtered.map((item) => (
            <FollowUpCell
              key={`${item.encounterId}-${item.actionId}`}
              item={item}
              onPress={() => onPressItem(item)}
              onComplete={() => onCompleteItem(item)}
              completing={completingId === `${item.encounterId}-${item.actionId}`}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No follow-ups match your search.</Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  tools: { gap: spacing.x3 },
  search: {
    minHeight: 48,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    color: colors.ink,
    backgroundColor: colors.canvas,
  },
  sortRow: { flexDirection: 'row', gap: spacing.x2 },
  list: { gap: spacing.x3 },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
