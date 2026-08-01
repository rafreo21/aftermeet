import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { readEnv } from '@/lib/env';

const nativeSecureStorage = {
  async getItem(key: string) {
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};

const browserStorage = {
  async getItem(key: string) {
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    window.localStorage.removeItem(key);
  },
};

let client: SupabaseClient | null = null;

export function getSupabase() {
  const env = readEnv();
  if (!env) return null;
  if (!client) {
    const isBrowser = typeof window !== 'undefined';
    const isNative = Platform.OS !== 'web';

    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: isNative ? nativeSecureStorage : isBrowser ? browserStorage : undefined,
        autoRefreshToken: isNative || isBrowser,
        persistSession: isNative || isBrowser,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
