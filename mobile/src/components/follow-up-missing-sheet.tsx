import { BottomSheet } from '@/components/bottom-sheet';
import { Button, Body } from '@/components/ui';
import { methodDisplayName, methodRequestLabel } from '@/features/follow-ups/channel-methods';
import type { FollowUpExecution } from '@/features/follow-ups/follow-up-executor';

type FollowUpMissingSheetProps = {
  visible: boolean;
  execution: FollowUpExecution | null;
  loading?: boolean;
  googleConnected?: boolean;
  onClose: () => void;
  onRequest?: () => void;
  onDraftTailoredEmail?: (preferGmail: boolean) => void;
  onDraftPreferredEmail?: (preferGmail: boolean) => void;
};

export function FollowUpMissingSheet({
  visible,
  execution,
  loading,
  googleConnected,
  onClose,
  onRequest,
  onDraftTailoredEmail,
  onDraftPreferredEmail,
}: FollowUpMissingSheetProps) {
  if (!execution || execution.type === 'open') return null;

  const hasEmail = execution.type === 'request' && execution.recipientEmail.includes('@');
  const methodLabel = execution.type === 'request'
    ? methodRequestLabel(execution.methodType)
    : null;

  return (
    <BottomSheet visible={visible} title="Contact info needed" onClose={onClose}>
      <Body>{execution.message}</Body>

      {execution.type === 'request' ? (
        <>
          <Body>
            We can notify them in AfterMeet and by push to add{' '}
            {execution.methodType === 'preferred_contact'
              ? 'a way to reach them'
              : methodDisplayName(execution.methodType)}{' '}
            to their card.
          </Body>
          <Button loading={loading} onPress={onRequest}>
            Request via AfterMeet
          </Button>
        </>
      ) : null}

      {hasEmail ? (
        <>
          <Body>
            {googleConnected
              ? 'Your Google account is connected — we can open Gmail with everything filled in.'
              : 'We can open Gmail or your mail app with the recipient, subject, and message ready — you just tap Send.'}
          </Body>
          {execution.type === 'request' && execution.methodType !== 'preferred_contact' && methodLabel ? (
            <Button
              variant="secondary"
              loading={loading}
              onPress={() => onDraftTailoredEmail?.(true)}>
              Open Gmail — ask for {methodLabel}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            loading={loading}
            onPress={() => onDraftPreferredEmail?.(true)}>
            Open Gmail — ask for preferred contact
          </Button>
          {!googleConnected ? (
            <Button
              variant="ghost"
              loading={loading}
              onPress={() => onDraftTailoredEmail?.(false)}>
              Use default mail app instead
            </Button>
          ) : null}
        </>
      ) : null}

      <Button variant="ghost" onPress={onClose}>Not now</Button>
    </BottomSheet>
  );
}
