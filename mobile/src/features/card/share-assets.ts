import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { readEnv } from '@/lib/env';

export type ShareAssetType = 'virtual-background' | 'watch-face';

export async function downloadShareAsset(
  slug: string,
  type: ShareAssetType,
  accessToken: string,
) {
  const env = readEnv();
  if (!env) throw new Error('App configuration is missing.');

  const response = await fetch(
    `${env.publicCardBaseUrl}/api/mobile/share-assets/${encodeURIComponent(slug)}?type=${type}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || 'We couldn’t download this asset.');
  }

  const svg = await response.text();
  const filename = `aftermeet-${type}-${slug}.svg`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, svg, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'image/svg+xml',
      dialogTitle: type === 'virtual-background' ? 'Virtual background' : 'Smart watch QR',
    });
    return path;
  }

  return path;
}

export function watchSetupInstructions(platform: 'ios' | 'android') {
  if (platform === 'ios') {
    return 'Download the watch QR, then add it as a photo on your Apple Watch face (Photos or Modular Compact).';
  }
  return 'Download the watch QR, then set it as a custom watch face image in Wear OS or Samsung Galaxy Watch.';
}

export function virtualBackgroundInstructions() {
  return 'Download the background, then set it in Zoom, Google Meet, or Teams under virtual backgrounds.';
}
