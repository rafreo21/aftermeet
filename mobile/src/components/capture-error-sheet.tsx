import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';

type CaptureErrorSheetProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export function CaptureErrorSheet({ visible, message, onClose }: CaptureErrorSheetProps) {
  return (
    <OutcomeErrorSheet
      visible={visible}
      message={message}
      onClose={onClose}
      hint="Fix the issue and try again. Your capture progress is still saved."
    />
  );
}
