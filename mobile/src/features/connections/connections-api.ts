import { mobileFetch } from '@/lib/mobile-api';

import { lookupPublishedCardSlug } from './connection-card-loader';
import {
  connectionAvatarUrl,
  fetchPublicConnectionCard,
} from './connection-public-card';

export type ConnectionSource = 'met' | 'inbound' | 'contact';

export type ConnectionSort = 'date' | 'az';

export type ConnectionItem = {
  id: string;
  sourceId: string;
  name: string;
  subtitle: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  source: ConnectionSource;
  cardSlug?: string;
  connectedAt?: string;
};

type PeopleConnection = {
  id: string;
  personName?: string;
  personRole?: string;
  personCompany?: string;
  personEmail?: string;
  cardSlug?: string;
  cardOwnerName?: string;
  connectedAt?: string;
};

type InboundExchange = {
  id: string;
  visitor_name?: string;
  visitor_email?: string;
  visitor_phone?: string;
  visitor_company?: string;
  visitor_role?: string;
  note?: string;
  created_at?: string;
};

type ContactRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
};

function subtitle(role?: string, company?: string, fallback = 'Connected through AfterMeet') {
  const parts = [role?.trim(), company?.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : fallback;
}

function mergeKey(name: string, email?: string) {
  return `${name.trim().toLowerCase()}|${(email || '').trim().toLowerCase()}`;
}

export async function fetchPeopleConnections(accessToken: string) {
  const response = await mobileFetch('/api/people/connections', accessToken);
  const payload = await response.json() as { connections?: PeopleConnection[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load people you’ve met.');
  }
  return payload.connections ?? [];
}

export async function fetchContacts(accessToken: string) {
  const response = await mobileFetch('/api/contacts', accessToken);
  const payload = await response.json() as { contacts?: ContactRow[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load your contacts.');
  }
  return payload.contacts ?? [];
}

export async function fetchInboundExchanges(accessToken: string) {
  const response = await mobileFetch('/api/cards/exchanges', accessToken);
  const payload = await response.json() as { exchanges?: InboundExchange[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load inbound connections.');
  }
  return payload.exchanges ?? [];
}

async function enrichConnectionPhotos(accessToken: string, connections: ConnectionItem[]) {
  const withSlugs = await Promise.all(connections.map(async (connection) => {
    if (connection.cardSlug?.trim()) return connection;
    if (!connection.email?.trim()) return connection;
    const slug = await lookupPublishedCardSlug(accessToken, connection.email);
    return slug ? { ...connection, cardSlug: slug } : connection;
  }));

  const slugs = [...new Set(withSlugs.map((item) => item.cardSlug).filter(Boolean))] as string[];
  const photoEntries = await Promise.all(slugs.map(async (slug) => {
    const card = await fetchPublicConnectionCard(slug);
    return [slug, card?.profileImageUrl || ''] as const;
  }));
  const photoMap = Object.fromEntries(photoEntries);

  return withSlugs.map((connection) => {
    const photoFromCard = connection.cardSlug ? photoMap[connection.cardSlug] : '';
    const photoUrl = photoFromCard || connection.photoUrl;
    return {
      ...connection,
      photoUrl: photoUrl || connectionAvatarUrl(connection),
    };
  });
}

export async function fetchAllConnections(accessToken: string): Promise<ConnectionItem[]> {
  const [people, exchanges, contacts] = await Promise.all([
    fetchPeopleConnections(accessToken).catch(() => [] as PeopleConnection[]),
    fetchInboundExchanges(accessToken).catch(() => [] as InboundExchange[]),
    fetchContacts(accessToken).catch(() => [] as ContactRow[]),
  ]);

  const merged = new Map<string, ConnectionItem>();

  for (const row of people) {
    const name = row.cardOwnerName?.trim() || row.personName?.trim() || 'Connection';
    const item: ConnectionItem = {
      id: `met-${row.id}`,
      sourceId: row.id,
      name,
      subtitle: subtitle(row.personRole, row.personCompany),
      email: row.personEmail?.trim() || undefined,
      source: 'met',
      cardSlug: row.cardSlug?.trim() || undefined,
      connectedAt: row.connectedAt,
    };
    merged.set(mergeKey(name, item.email), item);
  }

  for (const exchange of exchanges) {
    const name = exchange.visitor_name?.trim() || 'New connection';
    const item: ConnectionItem = {
      id: `inbound-${exchange.id}`,
      sourceId: exchange.id,
      name,
      role: exchange.visitor_role?.trim() || undefined,
      company: exchange.visitor_company?.trim() || undefined,
      subtitle: subtitle(exchange.visitor_role, exchange.visitor_company, 'Shared their details with you'),
      email: exchange.visitor_email?.trim() || undefined,
      phone: exchange.visitor_phone?.trim() || undefined,
      source: 'inbound',
      connectedAt: exchange.created_at,
    };
    const key = mergeKey(name, item.email);
    if (!merged.has(key)) merged.set(key, item);
  }

  for (const contact of contacts) {
    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email?.trim() || 'Contact';
    const item: ConnectionItem = {
      id: `contact-${contact.id}`,
      sourceId: contact.id,
      name,
      subtitle: subtitle(contact.role, contact.company, 'Added by you'),
      email: contact.email?.trim() || undefined,
      phone: contact.phone?.trim() || undefined,
      source: 'contact',
    };
    const key = mergeKey(name, item.email);
    if (!merged.has(key)) merged.set(key, item);
  }

  const connections = Array.from(merged.values());
  return enrichConnectionPhotos(accessToken, connections);
}

export function sortConnections(connections: ConnectionItem[], sort: ConnectionSort) {
  const next = [...connections];
  if (sort === 'az') {
    next.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
    return next;
  }
  next.sort((left, right) => Date.parse(right.connectedAt || '0') - Date.parse(left.connectedAt || '0'));
  return next;
}

export function filterConnections(connections: ConnectionItem[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return connections;
  return connections.filter((connection) => (
    connection.name.toLowerCase().includes(needle)
    || connection.subtitle.toLowerCase().includes(needle)
    || (connection.email || '').toLowerCase().includes(needle)
  ));
}

export function connectionSourceLabel(source: ConnectionSource) {
  if (source === 'inbound') return 'Shared with you';
  if (source === 'contact') return 'Added by you';
  return 'Saved card';
}

export async function deleteConnection(accessToken: string, connection: ConnectionItem) {
  if (connection.source === 'met') {
    const response = await mobileFetch(`/api/people/connections/${encodeURIComponent(connection.sourceId)}`, accessToken, {
      method: 'DELETE',
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Could not remove this connection.');
    return;
  }

  if (connection.source === 'inbound') {
    const response = await mobileFetch('/api/cards/exchanges', accessToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: connection.sourceId, status: 'dismissed' }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Could not remove this connection.');
    return;
  }

  const response = await mobileFetch(`/api/contacts/${encodeURIComponent(connection.sourceId)}`, accessToken, {
    method: 'DELETE',
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Could not remove this contact.');
}

export function parseConnectionId(value: string) {
  const match = /^(met|inbound|contact)-(.+)$/.exec(value.trim());
  if (!match) return null;
  return {
    source: match[1] as ConnectionSource,
    sourceId: match[2],
    id: value.trim(),
  };
}
