import { BottomSheet } from '@/components/bottom-sheet';
import { Body, Button } from '@/components/ui';

type CardDeleteSheetProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function CardDeleteSheet({
  visible,
  title,
  onCancel,
  onConfirm,
  loading,
}: CardDeleteSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Delete this card?"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onPress={onCancel} disabled={loading}>Keep card</Button>
          <Button onPress={onConfirm} loading={loading}>Yes, delete card</Button>
        </>
      }>
      <Body>
        {title ? `Delete "${title}"?` : 'Delete this card?'} It will be removed from your library and taken offline. This cannot be undone.
      </Body>
    </BottomSheet>
  );
}
