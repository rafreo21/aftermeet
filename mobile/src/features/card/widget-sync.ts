import { NativeModules, Platform } from 'react-native';

import { showsCompanyDetails } from '@/features/card/company-display';
import { shareCardDeepLink } from '@/features/card/share-deep-link';
import type { MobileCard } from '@/features/card/types';
import { fetchInboundExchanges } from '@/features/encounters/encounter-api';
import { readEnv } from '@/lib/env';
import { buildWidgetQrFileUri } from '@/lib/widget-qr';
import type { WidgetConnection, WidgetSnapshot } from '@/features/card/widget-types';

type WidgetBridge = {
  updateWidget?: (payload: Record<string, string | undefined>) => Promise<void>;
};

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AM';
}

function connectionSubtitle(exchange: {
  visitor_role?: string;
  visitor_company?: string;
  note?: string;
}) {
  const parts = [exchange.visitor_role?.trim(), exchange.visitor_company?.trim()].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return exchange.note?.trim() || 'Shared via your card';
}

async function loadRecentConnections(accessToken?: string): Promise<WidgetConnection[]> {
  if (!accessToken) return [];
  try {
    const exchanges = await fetchInboundExchanges(accessToken);
    return exchanges.slice(0, 3).map((exchange) => ({
      name: exchange.visitor_name?.trim() || 'New connection',
      subtitle: connectionSubtitle(exchange),
      phone: exchange.visitor_phone?.trim() || undefined,
      email: exchange.visitor_email?.trim() || undefined,
    }));
  } catch {
    return [];
  }
}

export async function buildWidgetSnapshot(
  card: MobileCard,
  cardUrl?: string,
  accessToken?: string,
): Promise<WidgetSnapshot> {
  const env = readEnv();
  const resolvedUrl = cardUrl || `${env?.publicCardBaseUrl || 'http://localhost:3000'}/c/${card.slug}`;
  const showCompany = showsCompanyDetails(card);
  let qrImageUri: string | undefined;

  try {
    qrImageUri = await buildWidgetQrFileUri(resolvedUrl);
  } catch {
    qrImageUri = undefined;
  }

  return {
    name: card.name.trim() || 'My card',
    role: card.role.trim(),
    company: showCompany ? card.company.trim() : '',
    cardUrl: resolvedUrl,
    shareDeepLink: shareCardDeepLink(card),
    qrImageUri,
    initials: initialsFor(card.name),
    connections: await loadRecentConnections(accessToken),
  };
}

function bridgePayload(snapshot: WidgetSnapshot): Record<string, string | undefined> {
  const payload: Record<string, string | undefined> = {
    name: snapshot.name,
    role: snapshot.role,
    company: snapshot.company,
    cardUrl: snapshot.cardUrl,
    shareDeepLink: snapshot.shareDeepLink,
    qrImageUri: snapshot.qrImageUri,
    initials: snapshot.initials,
    recentConnectionsJson: JSON.stringify(snapshot.connections),
  };

  snapshot.connections.slice(0, 3).forEach((connection, index) => {
    const slot = index + 1;
    payload[`connection${slot}Name`] = connection.name;
    payload[`connection${slot}Subtitle`] = connection.subtitle;
    payload[`connection${slot}Phone`] = connection.phone;
    payload[`connection${slot}Email`] = connection.email;
  });

  return payload;
}

async function updateIosWidgets(snapshot: WidgetSnapshot) {
  const payload = {
    name: snapshot.name,
    role: snapshot.role,
    company: snapshot.company,
    shareDeepLink: snapshot.shareDeepLink,
    qrImageUri: snapshot.qrImageUri,
    initials: snapshot.initials,
    connection1Name: snapshot.connections[0]?.name || '',
    connection1Subtitle: snapshot.connections[0]?.subtitle || '',
    connection1Phone: snapshot.connections[0]?.phone || '',
    connection1Email: snapshot.connections[0]?.email || '',
    connection2Name: snapshot.connections[1]?.name || '',
    connection2Subtitle: snapshot.connections[1]?.subtitle || '',
    connection2Phone: snapshot.connections[1]?.phone || '',
    connection2Email: snapshot.connections[1]?.email || '',
    connection3Name: snapshot.connections[2]?.name || '',
    connection3Subtitle: snapshot.connections[2]?.subtitle || '',
    connection3Phone: snapshot.connections[2]?.phone || '',
    connection3Email: snapshot.connections[2]?.email || '',
  };

  const [{ default: qrScan }, { default: businessCard }, { default: recentConnections }] = await Promise.all([
    import('../../../widgets/QrScanWidget'),
    import('../../../widgets/BusinessCardWidget'),
    import('../../../widgets/RecentConnectionsWidget'),
  ]);

  qrScan.updateSnapshot(payload);
  businessCard.updateSnapshot(payload);
  recentConnections.updateSnapshot(payload);
}

export async function updateQuickShareWidget(
  card: MobileCard,
  cardUrl?: string,
  accessToken?: string,
) {
  const snapshot = await buildWidgetSnapshot(card, cardUrl, accessToken);

  if (Platform.OS === 'ios') {
    try {
      await updateIosWidgets(snapshot);
      return;
    } catch {
      throw new Error('The home-screen widget is available after installing a development or production build.');
    }
  }

  if (Platform.OS === 'android') {
    const bridge = NativeModules.QuickShareWidgetBridge as WidgetBridge | undefined;
    if (!bridge?.updateWidget) {
      throw new Error('Rebuild the Android app to enable the home-screen widget.');
    }
    await bridge.updateWidget(bridgePayload(snapshot));
    return;
  }

  throw new Error('Home-screen widgets are only available on iPhone and Android.');
}

export function widgetSetupInstructions(platform: 'ios' | 'android') {
  if (platform === 'android') {
    return 'Long-press your home screen → Widgets → AfterMeet. Choose QR Scan, Business Card, or Recent Connections.';
  }
  return 'Long-press your home screen → Edit → Add Widget → AfterMeet. Choose QR Scan, Business Card, or Recent Connections.';
}
