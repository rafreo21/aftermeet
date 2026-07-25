export const CARD_LIBRARY_KEY = "aftermeet-card-library-v1";
export const ACTIVE_CARD_KEY = "aftermeet-active-card-v1";
export const MAX_CARDS = 5;

export type LibraryMethod = {
  id: string;
  type: string;
  value: string;
  label: string;
};

export type LibraryCard = {
  id: string;
  slug: string;
  label: string;
  name: string;
  role: string;
  company: string;
  bio: string;
  theme: string;
  photo: string;
  companyLogo: string;
  coverPhoto: string;
  methods: LibraryMethod[];
  createdAt: string;
  updatedAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function newIdentity() {
  const id = crypto.randomUUID();
  return { id, slug: `card-${id.replaceAll("-", "").slice(0, 16)}` };
}

export function createLibraryCard(seed: Partial<LibraryCard> = {}): LibraryCard {
  const identity = newIdentity();
  const now = new Date().toISOString();
  return {
    ...identity,
    label: "New card",
    name: "",
    role: "",
    company: "",
    bio: "",
    theme: "#9fe870",
    photo: "",
    companyLogo: "",
    coverPhoto: "",
    methods: [],
    ...seed,
    id: seed.id || identity.id,
    slug: seed.slug || identity.slug,
    createdAt: seed.createdAt || now,
    updatedAt: seed.updatedAt || now,
  };
}

export function readCardLibrary(storage: StorageLike): LibraryCard[] {
  try {
    const stored = JSON.parse(storage.getItem(CARD_LIBRARY_KEY) || "[]");
    if (Array.isArray(stored) && stored.length) return stored.slice(0, MAX_CARDS);

    const legacy = JSON.parse(storage.getItem("aftermeet-card-v2") || "null");
    if (legacy) {
      const migrated = createLibraryCard({
        ...legacy,
        id: legacy.id || "primary-card",
        slug: legacy.slug || "alex-morgan",
        label: legacy.label || "My primary card",
      });
      writeCardLibrary(storage, [migrated]);
      return [migrated];
    }
  } catch {}
  return [];
}

export function writeCardLibrary(storage: StorageLike, cards: LibraryCard[]) {
  storage.setItem(CARD_LIBRARY_KEY, JSON.stringify(cards.slice(0, MAX_CARDS)));
}

export function getActiveCardId(storage: StorageLike, cards: LibraryCard[]) {
  const stored = storage.getItem(ACTIVE_CARD_KEY);
  return cards.some((card) => card.id === stored) ? stored! : cards[0]?.id || "";
}

export function setActiveCardId(storage: StorageLike, id: string) {
  storage.setItem(ACTIVE_CARD_KEY, id);
}

export function upsertLibraryCard(storage: StorageLike, card: LibraryCard) {
  const cards = readCardLibrary(storage);
  const exists = cards.some((item) => item.id === card.id);
  if (!exists && cards.length >= MAX_CARDS) return cards;
  const nextCard = { ...card, updatedAt: new Date().toISOString() };
  const next = exists
    ? cards.map((item) => item.id === card.id ? nextCard : item)
    : [...cards, nextCard];
  writeCardLibrary(storage, next);
  setActiveCardId(storage, card.id);
  return next;
}

export function removeLibraryCard(storage: StorageLike, id: string) {
  const next = readCardLibrary(storage).filter((card) => card.id !== id);
  writeCardLibrary(storage, next);
  setActiveCardId(storage, next[0]?.id || "");
  if (!next.length) {
    storage.removeItem("aftermeet-card-v2");
    storage.removeItem("aftermeet-profile-v1");
    storage.removeItem("aftermeet-profile-photo-v1");
  }
  return next;
}
