import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { readEnv } from '@/lib/env';

export type ShareAssetType = 'virtual-background' | 'watch-face';

function assetExtension(type: ShareAssetType) {
  return type === 'virtual-background' ? 'jpg' : 'png';
}

function assetMimeType(type: ShareAssetType) {
  return type === 'virtual-background' ? 'image/jpeg' : 'image/png';
}

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

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('The server returned an invalid image file.');
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 256) {
    throw new Error('The downloaded image looks incomplete.');
  }

  const filename = `aftermeet-${type}-${slug}.${assetExtension(type)}`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, arrayBufferToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: assetMimeType(type),
      dialogTitle: type === 'virtual-background' ? 'Virtual background' : 'Smart watch QR',
    });
    return path;
  }

  return path;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function watchSetupInstructions(platform: 'ios' | 'android') {
  if (platform === 'ios') {
    return 'Download the watch QR, then add it as a photo on your Apple Watch face (Photos or Modular Compact).';
  }
  return 'Download the watch QR, then set it as a custom watch face image in Wear OS or Samsung Galaxy Watch.';
}

export function virtualBackgroundInstructions() {
  return 'Downloads a 1920×1080 JPG — the format Zoom, Google Meet, and Teams accept. Import it in your meeting app under virtual backgrounds.';
}
