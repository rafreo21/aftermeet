import type { MobileCard } from '@/features/card/types';
import { updateQuickShareWidget } from '@/features/card/widget-sync';

export async function syncCardToolsForCard(
  card: MobileCard | undefined,
  cardUrl?: string,
  accessToken?: string,
) {
  if (!card || card.status !== 'published' || !card.slug) return;
  try {
    await updateQuickShareWidget(card, cardUrl, accessToken);
  } catch {
    // Widget sync is best-effort and surfaces in Card Tools when it fails.
  }
}
