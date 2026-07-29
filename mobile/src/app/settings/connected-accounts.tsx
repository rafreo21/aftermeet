import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarBlank, EnvelopeSimple, GoogleLogo, LinkedinLogo } from 'phosphor-react-native';

import { Body, Button, PageHeader, Panel, Screen } from '@/components/ui';
import { SettingsSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import {
  disconnectIntegration,
  fetchConnectedAccounts,
  type ConnectedAccountStatus,
} from '@/features/integrations/integrations-api';
import { readEnv } from '@/lib/env';
import { colors, spacing } from '@/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

type ProviderRow = {
  id: 'google' | 'microsoft' | 'linkedin' | 'apple';
  name: string;
  description: string;
  icon: React.ReactNode;
  connectable: boolean;
};

const PROVIDERS: ProviderRow[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Send approved drafts through Gmail and schedule in Google Calendar.',
    icon: <GoogleLogo size={20} color={colors.ink} weight="bold" />,
    connectable: true,
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    description: 'Send approved drafts through Outlook and schedule in Outlook Calendar.',
    icon: <EnvelopeSimple size={20} color={colors.ink} weight="bold" />,
    connectable: true,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Coming soon. Connect your LinkedIn profile for richer follow-ups.',
    icon: <LinkedinLogo size={20} color={colors.ink} weight="bold" />,
    connectable: false,
  },
  {
    id: 'apple',
    name: 'Apple',
    description: 'Coming soon. Connect Apple services for contacts and calendar.',
    icon: <CalendarBlank size={20} color={colors.ink} weight="bold" />,
    connectable: false,
  },
];

export default function ConnectedAccountsScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ integration?: string | string[] }>();
  const [status, setStatus] = useState<ConnectedAccountStatus | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.access_token) {
      setInitialLoading(false);
      return;
    }
    const next = await fetchConnectedAccounts(session.access_token);
    setStatus(next);
    setInitialLoading(false);
  }, [session?.access_token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const integration = Array.isArray(params.integration) ? params.integration[0] : params.integration;
    if (!integration) return;
    if (integration.endsWith('-connected')) {
      setMessage(integration.startsWith('google')
        ? 'Google account connected.'
        : 'Microsoft account connected.');
      return;
    }
    if (integration.endsWith('-error')) {
      setError('We couldn’t connect that account. Try again.');
      return;
    }
    if (integration.endsWith('-unconfigured')) {
      setError('Integration credentials are not configured yet.');
    }
  }, [params.integration]);

  async function connectProvider(provider: 'google' | 'microsoft') {
    if (!session?.access_token) {
      router.push('/auth');
      return;
    }

    const env = readEnv();
    if (!env) {
      setError('AfterMeet API URL is not configured.');
      return;
    }

    setBusyProvider(provider);
    setError('');
    setMessage('');

    try {
      const callbackUrl = Linking.createURL('integrations/callback');
      const connectUrl = `${env.publicCardBaseUrl}/api/integrations/${provider}/connect?return_to=${encodeURIComponent(callbackUrl)}&access_token=${encodeURIComponent(session.access_token)}`;
      const result = await WebBrowser.openAuthSessionAsync(connectUrl, callbackUrl);
      if (result.type === 'success' && result.url) {
        handleCallbackUrl(result.url);
      }
      await refresh();
    } catch {
      setError(`We couldn’t connect ${provider === 'google' ? 'Google' : 'Microsoft'}. Try again.`);
    } finally {
      setBusyProvider(null);
    }
  }

  function handleCallbackUrl(url: string) {
    const integration = new URL(url).searchParams.get('integration') || '';
    if (integration.endsWith('-connected')) {
      setMessage(integration.startsWith('google')
        ? 'Google account connected.'
        : 'Microsoft account connected.');
      return;
    }
    if (integration.endsWith('-error')) {
      setError('We couldn’t connect that account. Try again.');
      return;
    }
    if (integration.endsWith('-unconfigured')) {
      setError('Integration credentials are not configured yet.');
    }
  }

  async function disconnect(provider: 'google' | 'microsoft') {
    if (!session?.access_token) return;
    setBusyProvider(provider);
    setError('');
    setMessage('');
    try {
      await disconnectIntegration(session.access_token, provider);
      setMessage(`${provider === 'google' ? 'Google' : 'Microsoft'} disconnected.`);
      await refresh();
    } catch {
      setError('We couldn’t disconnect that account.');
    } finally {
      setBusyProvider(null);
    }
  }

  function providerStatus(id: ProviderRow['id']) {
    if (!status) return null;
    if (id === 'google') return status.google;
    if (id === 'microsoft') return status.microsoft;
    return null;
  }

  return (
    <Screen>
      <PageHeader eyebrow="Settings" title="Connected accounts" />
      <Body>
        Connect the accounts AfterMeet can use for approved outbound drafts, calendar scheduling, and future integrations.
      </Body>

      {session && initialLoading ? <SettingsSkeleton /> : null}

      {!session ? (
        <Panel>
          <Text style={styles.panelTitle}>Sign in required</Text>
          <Text style={styles.panelCopy}>Sign in to connect Gmail, Outlook, and other accounts.</Text>
          <Button onPress={() => router.push('/auth')}>Sign in</Button>
        </Panel>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {session && !initialLoading ? (
      <View style={styles.list}>
        {PROVIDERS.map((provider) => {
          const account = providerStatus(provider.id);
          const connected = Boolean(account?.connected);
          const loading = busyProvider === provider.id;

          return (
            <Panel key={provider.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>{provider.icon}</View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{provider.name}</Text>
                  <Text style={styles.cardDescription}>
                    {connected && account?.email ? account.email : provider.description}
                  </Text>
                </View>
              </View>
              {!provider.connectable ? (
                <Text style={styles.soon}>Coming soon</Text>
              ) : loading ? (
                <ActivityIndicator color={colors.ink} />
              ) : connected ? (
                <Button variant="secondary" onPress={() => void disconnect(provider.id as 'google' | 'microsoft')}>
                  Disconnect
                </Button>
              ) : (
                <Button onPress={() => void connectProvider(provider.id as 'google' | 'microsoft')}>
                  Connect {provider.name}
                </Button>
              )}
            </Panel>
          );
        })}
      </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.x3 },
  card: { gap: spacing.x4 },
  cardHeader: { flexDirection: 'row', gap: spacing.x3, alignItems: 'flex-start' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  cardCopy: { flex: 1, gap: 4 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  cardDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  panelTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  panelCopy: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 19 },
  message: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  soon: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
});
