import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, Trash } from 'phosphor-react-native';

import { Body, Button, PageHeader, Panel, Screen } from '@/components/ui';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { SettingsSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useCard } from '@/features/card/card-context';
import { saveConnectionToAfterMeet } from '@/features/connections/save-connection-contact';
import { fetchInboundExchanges, type InboundExchange } from '@/features/encounters/encounter-api';
import { mobileFetch } from '@/lib/mobile-api';
import { formatDateTime } from '@/lib/relative-time';
import { colors, spacing } from '@/theme/tokens';

async function dismissExchange(accessToken: string, id: string) {
  const response = await mobileFetch('/api/cards/exchanges', accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status: 'dismissed' }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Could not update this scan.');
}

function formatScanMeta(exchange: InboundExchange) {
  return [exchange.visitor_email, exchange.visitor_phone].filter(Boolean).join(' · ')
    || exchange.visitor_company
    || 'No contact details shared';
}

export default function RecentScansScreen() {
  const { session } = useAuth();
  const { card } = useCard();
  const accessToken = session?.access_token ?? null;
  const [exchanges, setExchanges] = useState<InboundExchange[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setInitialLoading(false);
      return;
    }
    try {
      const items = await fetchInboundExchanges(accessToken);
      setExchanges(items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your scans.');
    } finally {
      setInitialLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  async function addToDirectory(exchange: InboundExchange) {
    if (!accessToken) return;
    setBusyId(exchange.id);
    setError('');
    try {
      await saveConnectionToAfterMeet(accessToken, {
        id: `inbound-${exchange.id}`,
        sourceId: exchange.id,
        name: exchange.visitor_name || 'Unknown visitor',
        subtitle: '',
        email: exchange.visitor_email || undefined,
        phone: exchange.visitor_phone || undefined,
        company: exchange.visitor_company || undefined,
        role: exchange.visitor_role || undefined,
        source: 'inbound',
      }, card);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this person to your directory.');
    } finally {
      setBusyId('');
    }
  }

  async function dismiss(exchange: InboundExchange) {
    if (!accessToken) return;
    setBusyId(exchange.id);
    setError('');
    try {
      await dismissExchange(accessToken, exchange.id);
      setExchanges((current) => current.filter((item) => item.id !== exchange.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this scan.');
    } finally {
      setBusyId('');
    }
  }

  const notSaved = exchanges.filter((exchange) => exchange.status !== 'imported');

  const header = (
    <>
      <PageHeader eyebrow="Settings" title="Recent scans" />
      <Body>People who scanned your card but haven&apos;t been added to your directory yet.</Body>
    </>
  );

  return (
    <Screen header={header}>
      {session && initialLoading ? <SettingsSkeleton /> : null}

      {!session ? (
        <Panel>
          <Text style={styles.panelTitle}>Sign in required</Text>
          <Text style={styles.panelCopy}>Sign in to see who has scanned your card.</Text>
        </Panel>
      ) : null}

      {session && !initialLoading && !notSaved.length ? (
        <Panel>
          <Text style={styles.panelTitle}>Nothing to add</Text>
          <Text style={styles.panelCopy}>Every scan has been saved, or you haven&apos;t had one yet.</Text>
        </Panel>
      ) : null}

      {notSaved.length ? (
        <View style={styles.list}>
          {notSaved.map((exchange) => (
            <Panel key={exchange.id} style={styles.card}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{exchange.visitor_name || 'Unknown visitor'}</Text>
                <Text style={styles.cardDescription}>{formatScanMeta(exchange)}</Text>
                {formatDateTime(exchange.created_at || '') ? (
                  <Text style={styles.cardDate}>{formatDateTime(exchange.created_at || '')}</Text>
                ) : null}
              </View>
              {busyId === exchange.id ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <View style={styles.cardActions}>
                  <Button onPress={() => void addToDirectory(exchange)}>
                    <CheckCircle size={16} color={colors.ink} weight="bold" />
                    Add
                  </Button>
                  <Button variant="ghost" onPress={() => void dismiss(exchange)}>
                    <Trash size={16} color={colors.muted} />
                    Dismiss
                  </Button>
                </View>
              )}
            </Panel>
          ))}
        </View>
      ) : null}

      <OutcomeErrorSheet
        visible={Boolean(error)}
        message={error}
        onClose={() => setError('')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panelTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  panelCopy: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 19 },
  list: { gap: spacing.x2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    padding: spacing.x4,
  },
  cardCopy: { flex: 1, gap: 2 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  cardDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  cardDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
  cardActions: { gap: spacing.x2 },
});
