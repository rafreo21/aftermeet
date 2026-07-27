import { addContactAsync, ContactTypes, requestPermissionsAsync } from 'expo-contacts/legacy';

import type { MobileCard } from '@/features/card/types';
import { mobileFetch } from '@/lib/mobile-api';

import type { ConnectionItem } from './connections-api';

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Contact',
    lastName: parts.slice(1).join(' '),
  };
}

function contactPayloadFromConnection(connection: ConnectionItem, card?: MobileCard | null) {
  const { firstName, lastName } = splitName(card?.name || connection.name);
  const email = card?.methods.find((method) => method.type === 'email')?.value || connection.email || '';
  const phone = card?.methods.find((method) => method.type === 'phone' || method.type === 'whatsapp')?.value || connection.phone || '';
  const linkedinUrl = card?.methods.find((method) => method.type === 'linkedin')?.value;

  const id = connection.cardSlug
    ? `card-${connection.cardSlug}`
    : connection.source === 'inbound'
      ? `exchange-${connection.sourceId}`
      : connection.source === 'met'
        ? `met-${connection.sourceId}`
        : `contact-${connection.sourceId}`;

  return {
    id,
    firstName,
    lastName,
    email,
    phone: phone || undefined,
    linkedinUrl: linkedinUrl || undefined,
    company: card?.company || connection.company || '',
    role: card?.role || connection.role || '',
    context: connection.subtitle,
    source: connection.source === 'inbound' ? 'exchange' as const : connection.source === 'met' ? 'scan' as const : 'manual' as const,
    exchangeId: connection.source === 'inbound' ? connection.sourceId : undefined,
  };
}

export async function saveConnectionToAfterMeet(accessToken: string, connection: ConnectionItem, card?: MobileCard | null) {
  const response = await mobileFetch('/api/contacts', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contactPayloadFromConnection(connection, card)),
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Could not save this person to your directory.');
  }
}

export async function saveConnectionToDeviceContacts(connection: ConnectionItem, card?: MobileCard | null) {
  const permission = await requestPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Allow contacts access to save this person to your phone.');
  }

  const fullName = card?.name.trim() || connection.name.trim();
  const { firstName, lastName } = splitName(fullName);
  const emails = (card?.methods ?? [])
    .filter((method) => method.type === 'email')
    .map((method) => ({ label: 'work', email: method.value }));
  if (!emails.length && connection.email) {
    emails.push({ label: 'work', email: connection.email });
  }

  const phoneNumbers = (card?.methods ?? [])
    .filter((method) => method.type === 'phone' || method.type === 'whatsapp')
    .map((method) => ({ label: 'mobile', number: method.value }));
  if (!phoneNumbers.length && connection.phone) {
    phoneNumbers.push({ label: 'mobile', number: connection.phone });
  }

  const urlAddresses = (card?.methods ?? [])
    .filter((method) => ['linkedin', 'instagram', 'website', 'x'].includes(method.type))
    .map((method) => ({ label: method.label, url: method.value }));

  await addContactAsync({
    contactType: ContactTypes.Person,
    name: fullName,
    firstName,
    lastName,
    company: card?.company || connection.company || '',
    jobTitle: card?.role || connection.role || '',
    emails,
    phoneNumbers,
    urlAddresses,
  });
}
