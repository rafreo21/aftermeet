import type { MobileCard } from '@/features/card/types';
import { mobileFetch } from '@/lib/mobile-api';
import { readEnv } from '@/lib/env';

import type { ConnectionItem } from './connections-api';
import {
  connectionCardFromProfile,
  fetchPublicConnectionCard,
  publicCardToMobileCard,
} from './connection-public-card';

export async function lookupPublishedCardSlug(accessToken: string, email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;

  const response = await mobileFetch(
    `/api/cards/public/lookup?email=${encodeURIComponent(trimmed)}`,
    accessToken,
  );
  if (!response.ok) return null;

  const payload = await response.json() as { slug?: string | null };
  return payload.slug?.trim() || null;
}

export async function resolveConnectionCardSlug(connection: ConnectionItem, accessToken?: string) {
  if (connection.cardSlug?.trim()) return connection.cardSlug.trim();

  if (accessToken && connection.email?.trim()) {
    const slug = await lookupPublishedCardSlug(accessToken, connection.email);
    if (slug) return slug;
  }

  return null;
}

export async function loadConnectionLiveCard(connection: ConnectionItem, accessToken?: string) {
  const slug = await resolveConnectionCardSlug(connection, accessToken);

  if (slug) {
    const publicCard = await fetchPublicConnectionCard(slug);
    if (publicCard) {
      return {
        slug,
        card: publicCardToMobileCard(publicCard),
        publicUrl: readEnv()?.publicCardBaseUrl ? `${readEnv()!.publicCardBaseUrl}/c/${slug}` : undefined,
      };
    }
  }

  if (connection.source === 'inbound') {
    const fallback = connectionCardFromProfile(connection);
    if (fallback) {
      return {
        slug: slug || fallback.slug,
        card: fallback,
      };
    }
  }

  return { slug: slug || null, card: null as MobileCard | null };
}
