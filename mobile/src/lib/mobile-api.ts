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

export async function readMobileApiJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    const contentType = response.headers.get('content-type') ?? '';
    const receivedHtml = contentType.includes('text/html') || raw.trimStart().startsWith('<');
    throw new Error(receivedHtml
      ? 'AfterMeet could not reach its API. The server may be temporarily unavailable or protected. Your work on this device is still safe.'
      : fallbackMessage);
  }
}
