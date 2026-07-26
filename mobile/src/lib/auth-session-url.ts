import type { SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

function readAuthCode(url: string) {
  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code;
  if (typeof code === 'string' && code.length > 0) return code;
  return null;
}

export async function completeAuthSessionFromUrl(supabase: SupabaseClient, url: string) {
  const code = readAuthCode(url);
  if (!code) return { ok: false as const, reason: 'missing_code' as const };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { ok: false as const, reason: 'exchange_failed' as const, message: error.message };
  return { ok: true as const };
}

export async function readLaunchAuthUrl() {
  return Linking.getInitialURL();
}
