import { mobileFetch } from '@/lib/mobile-api';

export type ConnectedAccountStatus = {
  google: { connected: boolean; email: string };
  microsoft: { connected: boolean; email: string };
  configured?: { google: boolean; microsoft: boolean };
};

export async function fetchConnectedAccounts(accessToken: string): Promise<ConnectedAccountStatus> {
  const response = await mobileFetch('/api/integrations/status', accessToken);
  if (!response.ok) {
    throw new Error('Unable to load connected accounts.');
  }
  const payload = await response.json() as { status?: ConnectedAccountStatus };
  return payload.status ?? {
    google: { connected: false, email: '' },
    microsoft: { connected: false, email: '' },
  };
}

export async function disconnectIntegration(accessToken: string, provider: 'google' | 'microsoft') {
  const response = await mobileFetch(`/api/integrations/${provider}`, accessToken, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Unable to disconnect account.');
  }
}
