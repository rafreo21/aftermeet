import { useAuth } from '@/features/auth/auth-context';
import { flushPendingTranscriptions } from '@/features/encounters/capture-transcription-sync';
import { useForegroundSync } from '@/lib/background-sync';

export function CaptureTranscriptionSyncManager() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  useForegroundSync(Boolean(accessToken), () => {
    if (!accessToken) return;
    return flushPendingTranscriptions(accessToken);
  });

  return null;
}
