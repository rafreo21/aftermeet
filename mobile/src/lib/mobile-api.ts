import { readEnv } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

export async function mobileFetch(path: string, accessToken: string, init?: RequestInit) {
  const env = readEnv();
  const base = env?.publicCardBaseUrl;
  if (!base) throw new Error('AfterMeet API URL is not configured.');

  async function request(token: string) {
    return fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  }

  let response = await request(accessToken);
  if (response.status === 401) {
    const supabase = getSupabase();
    const { data } = await supabase?.auth.refreshSession() ?? { data: { session: null } };
    const refreshed = data.session?.access_token;
    if (refreshed && refreshed !== accessToken) {
      response = await request(refreshed);
    }
  }

  return response;
}
