import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getCaptureDeviceIdentity } from '@/features/encounters/capture-draft';
import { mobileFetch, readMobileApiJson } from '@/lib/mobile-api';
import { notificationPermissionGranted } from '@/features/notifications/notification-service';

/**
 * Remote push requires an EAS project id (set via `eas init`), which this
 * app does not have configured yet — see docs/product/00-product-source-of-truth.md
 * notification section. Registration silently no-ops until that one-time
 * infrastructure step happens; local scheduled notifications and the
 * Supabase-backed notification centre work regardless.
 */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

export async function registerPushToken(accessToken: string): Promise<void> {
  const projectId = easProjectId();
  if (!projectId) return;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!await notificationPermissionGranted()) return;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const device = await getCaptureDeviceIdentity();

    await mobileFetch('/api/notifications/push-tokens', accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: device.id,
        platform: Platform.OS,
        expoPushToken: tokenResponse.data,
        deviceLabel: Platform.OS === 'ios' ? 'iPhone' : 'Android device',
      }),
    });
  } catch {
    // Registration is best-effort — a missing/rotated token must never block app usage.
  }
}

export async function deactivatePushToken(accessToken: string): Promise<void> {
  try {
    const device = await getCaptureDeviceIdentity();
    const response = await mobileFetch(
      `/api/notifications/push-tokens?deviceId=${encodeURIComponent(device.id)}`,
      accessToken,
      { method: 'DELETE' },
    );
    await readMobileApiJson(response, 'Could not deactivate this device.').catch(() => undefined);
  } catch {
    // Best-effort cleanup on sign-out.
  }
}
