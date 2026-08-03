import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getCaptureDeviceIdentity } from '@/features/encounters/capture-draft';
import { mobileFetch, readMobileApiJson } from '@/lib/mobile-api';
import { notificationPermissionGranted } from '@/features/notifications/notification-service';

/**
 * Remote push requires an EAS project id, obtained by running `eas init`
 * against an authenticated Expo account — a one-time, account-owning step
 * this repo cannot perform on its own. `app.json`'s extra.eas.projectId is
 * what `eas init` writes automatically; EXPO_PUBLIC_EAS_PROJECT_ID is a
 * manual fallback so the id can be supplied without an app.json edit once
 * that step happens. Until either exists, registration silently no-ops —
 * local scheduled notifications and the Supabase-backed centre work
 * regardless. See docs/product/00-product-source-of-truth.md (Notifications)
 * and DEC-029/DEC-030 in docs/product/02-decision-log.md.
 */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined;
}

export function pushDeliveryConfigured(): boolean {
  return Boolean(easProjectId());
}

/**
 * Returns whether this device now holds an actively registered push token —
 * the only state that should ever be described to the user as "push is on."
 */
export async function registerPushToken(accessToken: string): Promise<boolean> {
  const projectId = easProjectId();
  if (!projectId) return false;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  if (!await notificationPermissionGranted()) return false;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const device = await getCaptureDeviceIdentity();

    const response = await mobileFetch('/api/notifications/push-tokens', accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: device.id,
        platform: Platform.OS,
        expoPushToken: tokenResponse.data,
        deviceLabel: Platform.OS === 'ios' ? 'iPhone' : 'Android device',
        deviceModel: Device.modelName || '',
      }),
    });
    return response.ok;
  } catch {
    // Registration is best-effort — a missing/rotated token must never block app usage.
    return false;
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
