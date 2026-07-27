import { BottomSheet } from '@/components/bottom-sheet';
import { Body, Button } from '@/components/ui';

type CaptureLeaveSheetProps = {
  visible: boolean;
  onStay: () => void;
  onDiscard: () => void;
};

export function CaptureLeaveSheet({ visible, onStay, onDiscard }: CaptureLeaveSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Leave capture?"
      onClose={onStay}
      footer={
        <>
          <Button variant="secondary" onPress={onStay}>Keep capturing</Button>
          <Button onPress={onDiscard}>Leave and discard</Button>
        </>
      }>
      <Body>
        Going back will clear this capture — your recording progress, transcript, notes, and follow-up draft will be reset.
      </Body>
    </BottomSheet>
  );
}
