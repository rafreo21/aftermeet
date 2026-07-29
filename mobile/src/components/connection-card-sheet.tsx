import { BottomSheet } from '@/components/bottom-sheet';
import { MobileCardPreview } from '@/components/mobile-card';
import { Body, Button } from '@/components/ui';
import type { MobileCard } from '@/features/card/types';
import type { ConnectionItem } from '@/features/connections/connections-api';

type ConnectionCardSheetProps = {
  visible: boolean;
  connection: ConnectionItem | null;
  card: MobileCard | null;
  directoryState: 'unsaved' | 'saved' | 'needs_update';
  loading?: boolean;
  onClose: () => void;
  onSaveDirectory: () => void;
};

export function ConnectionCardSheet({
  visible,
  connection,
  card,
  directoryState,
  loading,
  onClose,
  onSaveDirectory,
}: ConnectionCardSheetProps) {
  return (
    <BottomSheet visible={visible} title={connection?.name || 'Card'} onClose={onClose}>
      {card ? (
        <>
          <MobileCardPreview card={card} />
          <Body>
            {connection?.cardSlug || connection?.source !== 'inbound'
              ? 'Live card. Updates when they change it.'
              : 'Card from their shared details.'}
          </Body>
        </>
      ) : (
        <Body>No published card yet. Save their details to your directory instead.</Body>
      )}

      {directoryState === 'saved' ? (
        <Button variant="secondary" disabled>Saved to directory</Button>
      ) : (
        <Button loading={loading} onPress={onSaveDirectory}>
          {directoryState === 'needs_update' ? 'Update directory' : 'Save to directory'}
        </Button>
      )}
    </BottomSheet>
  );
}
