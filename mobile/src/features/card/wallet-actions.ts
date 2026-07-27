import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { mobileFetch } from '@/lib/mobile-api';

type WalletJson = {
  configured?: boolean;
  saveUrl?: string;
  error?: string;
};

async function readWalletError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as WalletJson;
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchWalletAvailability(slug: string, accessToken: string) {
  const platform = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'google' : null;
  if (!platform) {
    return { available: false, message: 'Wallet passes are only available on iPhone and Android.' };
  }

  const response = await mobileFetch(`/api/mobile/wallet/${platform}/${encodeURIComponent(slug)}`, accessToken, {
    method: 'GET',
  });

  if (response.ok) {
    return { available: true, message: '' };
  }

  return {
    available: false,
    message: await readWalletError(
      response,
      platform === 'apple'
        ? 'Apple Wallet is not available right now.'
        : 'Google Wallet is not available right now.',
    ),
  };
}

export async function addGoogleWalletPass(slug: string, accessToken: string) {
  const response = await mobileFetch(`/api/mobile/wallet/google/${encodeURIComponent(slug)}`, accessToken);
  const payload = await response.json() as WalletJson;
  if (!response.ok || !payload.saveUrl) {
    throw new Error(payload.error || 'Google Wallet is not available right now.');
  }
  await WebBrowser.openBrowserAsync(payload.saveUrl);
}

export async function addAppleWalletPass(slug: string, accessToken: string) {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Wallet passes are available on iPhone.');
  }

  const { readEnv } = await import('@/lib/env');
  const env = readEnv();
  const base = env?.publicCardBaseUrl;
  if (!base) throw new Error('AfterMeet API URL is not configured.');

  const downloadUrl = `${base}/api/mobile/wallet/apple/${encodeURIComponent(slug)}`;
  const path = `${FileSystem.cacheDirectory}${slug}.pkpass`;
  const result = await FileSystem.downloadAsync(downloadUrl, path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (result.status !== 200) {
    const response = await mobileFetch(`/api/mobile/wallet/apple/${encodeURIComponent(slug)}`, accessToken);
    throw new Error(await readWalletError(response, 'Apple Wallet is not available right now. Publish your card first.'));
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(path, {
    UTI: 'com.apple.pkpass',
    mimeType: 'application/vnd.apple.pkpass',
  });
}
