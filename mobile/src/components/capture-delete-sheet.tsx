import { BottomSheet } from '@/components/bottom-sheet';
import { Body, Button } from '@/components/ui';

type CaptureDeleteSheetProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function CaptureDeleteSheet({
  visible,
  title,
  onCancel,
  onConfirm,
  loading,
}: CaptureDeleteSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Are you sure you want to delete?"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onPress={onCancel} disabled={loading}>Keep capture</Button>
          <Button onPress={onConfirm} loading={loading}>Yes, delete everything</Button>
        </>
      }>
      <Body>
        {title ? `Delete "${title}"?` : 'Delete this capture?'} You will lose access to the summary, notes, transcript, and voice recording in the app. This cannot be undone.
      </Body>
    </BottomSheet>
  );
}
