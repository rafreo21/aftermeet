import {
  type LibraryCard,
  readCardLibrary,
  writeCardLibrary,
} from "./card-library";
import { cardMatchesLocal } from "./cards-server";

let hydratePromise: Promise<LibraryCard[]> | null = null;

function replaceLocalCard(previousId: string, nextCard: LibraryCard) {
  const current = readCardLibrary(localStorage);
  writeCardLibrary(localStorage, [
    nextCard,
    ...current.filter((card) => card.id !== previousId && card.id !== nextCard.id),
  ]);
}

export async function syncCardToServer(card: LibraryCard) {
  try {
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { card?: LibraryCard; preview?: boolean };
    if (!payload.card) return null;
    if (payload.card.id !== card.id) {
      replaceLocalCard(card.id, payload.card);
    }
    return payload.card;
  } catch {
    return null;
  }
}

export async function hydrateCardLibraryFromServer() {
  if (typeof window === "undefined") return readCardLibrary(localStorage);
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const response = await fetch("/api/cards");
      if (!response.ok) return readCardLibrary(localStorage);

      const payload = await response.json() as { cards?: LibraryCard[]; preview?: boolean };
      if (payload.preview) return readCardLibrary(localStorage);

      let serverCards = payload.cards ?? [];
      const localCards = readCardLibrary(localStorage);

      for (const local of localCards) {
        if (serverCards.some((server) => cardMatchesLocal(server, local))) continue;
        const synced = await syncCardToServer(local);
        if (synced) {
          serverCards = [synced, ...serverCards.filter((card) => card.id !== synced.id)];
        }
      }

      if (serverCards.length) {
        writeCardLibrary(localStorage, serverCards);
        return serverCards;
      }

      return readCardLibrary(localStorage);
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export function queueCardSync(card: LibraryCard) {
  void syncCardToServer(card);
}
