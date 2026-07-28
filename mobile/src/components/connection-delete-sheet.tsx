import { BottomSheet } from '@/components/bottom-sheet';
import { Body, Button } from '@/components/ui';

type ConnectionDeleteSheetProps = {
  visible: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function ConnectionDeleteSheet({
  visible,
  name,
  onCancel,
  onConfirm,
  loading,
}: ConnectionDeleteSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Are you sure you want to delete?"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onPress={onCancel} disabled={loading}>Keep</Button>
          <Button onPress={onConfirm} loading={loading}>Yes, delete</Button>
        </>
      }>
      <Body>
        Remove {name || 'this connection'} from your list? Their card stays online — this only removes them from your connections and shared directory link here.
      </Body>
    </BottomSheet>
  );
}
