import { readEnv } from '@/lib/env';

export async function mobileFetch(path: string, accessToken: string, init?: RequestInit) {
  const env = readEnv();
  const base = env?.publicCardBaseUrl;
  if (!base) throw new Error('AfterMeet API URL is not configured.');

  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });
}
