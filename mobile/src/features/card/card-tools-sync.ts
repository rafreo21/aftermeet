import type { MobileCard } from '@/features/card/types';
import { syncAllWidgets } from '@/features/card/widget-sync';

export async function syncCardToolsForCard(
  cards: MobileCard[],
  cardPublicUrl: (card: MobileCard) => string,
  accessToken?: string,
  preferredCard?: MobileCard,
) {
  if (!cards.length) return;

  try {
    await syncAllWidgets(cards, cardPublicUrl, accessToken, preferredCard);
  } catch {
    // Widget sync is best-effort and surfaces in Card Tools when it fails.
  }
}
