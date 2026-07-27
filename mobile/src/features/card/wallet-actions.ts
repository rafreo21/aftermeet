import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { readEnv } from '@/lib/env';
import { mobileFetch } from '@/lib/mobile-api';

type WalletJson = {
  configured?: boolean;
  saveUrl?: string;
  error?: string;
};

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

  const env = readEnv();
  if (!env) throw new Error('AfterMeet API URL is not configured.');

  const path = `${FileSystem.cacheDirectory}${slug}.pkpass`;
  const result = await FileSystem.downloadAsync(
    `${env.publicCardBaseUrl}/api/mobile/wallet/apple/${encodeURIComponent(slug)}`,
    path,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (result.status !== 200) {
    throw new Error('Apple Wallet is not available right now. Publish your card first.');
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(result.uri, {
    UTI: 'com.apple.pkpass',
    mimeType: 'application/vnd.apple.pkpass',
  });
}
