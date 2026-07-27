import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import {
  ACTIVE_CARD_KEY,
  CARDS_STORAGE_KEY,
  createMobileCard,
  getActiveCardId,
  LEGACY_CARD_KEY,
  MAX_CARDS,
  mobileCardToLibraryPayload,
  remoteRowToMobileCard,
} from '@/features/card/card-library';
import { CARD_THEMES, normalizeThemeColor } from '@/features/card/theme-colors';
import { defaultCard } from '@/features/card/default-card';
import type { ContactMethod, MobileCard } from '@/features/card/types';
import { updateQuickShareWidget } from '@/features/card/widget-sync';
import { readEnv } from '@/lib/env';
import { mobileFetch } from '@/lib/mobile-api';
import { getSupabase } from '@/lib/supabase';

type CardValue = {
  cards: MobileCard[];
  card: MobileCard;
  activeCardId: string;
  loading: boolean;
  syncing: boolean;
  publishing: boolean;
  publishError: string;
  publicUrl: string;
  canCreateCard: boolean;
  getCardById: (id: string) => MobileCard | undefined;
  cardPublicUrl: (card: MobileCard) => string;
  isPrimaryCard: (id: string) => boolean;
  setPrimaryCard: (id: string) => Promise<void>;
  setActiveCard: (id: string) => Promise<void>;
  createCard: (seed?: Partial<MobileCard>) => Promise<MobileCard | null>;
  updateCard: (changes: Partial<MobileCard>) => Promise<void>;
  updateCardById: (id: string, changes: Partial<MobileCard>) => Promise<void>;
  addMethod: (method: ContactMethod) => Promise<void>;
  removeMethod: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  publish: () => Promise<boolean>;
  publishCard: (id?: string) => Promise<boolean>;
};

const CardContext = createContext<CardValue | null>(null);

function normalizeCard(card: MobileCard): MobileCard {
  return { ...card, theme: normalizeThemeColor(card.theme) };
}

function cardsSnapshot(cards: MobileCard[]) {
  return JSON.stringify(cards.map(normalizeCard));
}

function mapStoredCards(raw: unknown): MobileCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_CARDS).map((item) => normalizeCard({ ...createMobileCard(), ...(item as MobileCard) }));
}

export function CardProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [cards, setCards] = useState<MobileCard[]>([defaultCard]);
  const [activeCardId, setActiveCardIdState] = useState(defaultCard.id || '');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  const cardsRef = useRef(cards);
  const activeCardIdRef = useRef(activeCardId);
  cardsRef.current = cards;
  activeCardIdRef.current = activeCardId;

  const activeCard = useMemo(
    () => cards.find((item) => item.id === activeCardId) || cards[0] || defaultCard,
    [activeCardId, cards],
  );

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CARDS_STORAGE_KEY),
      AsyncStorage.getItem(LEGACY_CARD_KEY),
      AsyncStorage.getItem(ACTIVE_CARD_KEY),
    ]).then(([storedCards, legacyCard, storedActiveId]) => {
      let nextCards = mapStoredCards(storedCards ? JSON.parse(storedCards) : []);
      if (!nextCards.length && legacyCard) {
        try {
          nextCards = [normalizeCard({ ...defaultCard, ...JSON.parse(legacyCard) as MobileCard })];
        } catch {}
      }
      if (!nextCards.length) nextCards = [defaultCard];
      setCards(nextCards);
      setActiveCardIdState(getActiveCardId(nextCards, storedActiveId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const persistCards = useCallback(async (nextCards: MobileCard[], nextActiveId?: string) => {
    const normalized = nextCards.map(normalizeCard);
    const resolvedActiveId = nextActiveId ?? activeCardIdRef.current;
    if (
      resolvedActiveId === activeCardIdRef.current
      && cardsSnapshot(normalized) === cardsSnapshot(cardsRef.current)
    ) {
      return;
    }
    setCards(normalized);
    setActiveCardIdState(resolvedActiveId);
    await AsyncStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(normalized));
    await AsyncStorage.setItem(ACTIVE_CARD_KEY, resolvedActiveId);
    const active = normalized.find((item) => item.id === resolvedActiveId) || normalized[0];
    if (active) await updateQuickShareWidget(active);
  }, []);

  const saveRemoteCard = useCallback(async (card: MobileCard) => {
    if (!session?.access_token) return;
    const response = await mobileFetch('/api/cards', session.access_token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mobileCardToLibraryPayload(card)),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || 'We couldn’t save this card.');
    }
  }, [session?.access_token]);

  const sync = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setSyncing(true);
    try {
      const { data: rawContext } = await supabase.rpc('get_my_app_context').single();
      const context = rawContext as { workspace_id?: string } | null;
      if (!context?.workspace_id) return;
      const { data: remoteRows } = await supabase
        .from('cards')
        .select('*, card_methods(*)')
        .eq('workspace_id', context.workspace_id)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false })
        .limit(MAX_CARDS);
      if (remoteRows?.length) {
        const remoteCards = remoteRows.map((row) => remoteRowToMobileCard(row));
        const nextActiveId = getActiveCardId(remoteCards, activeCardIdRef.current);
        await persistCards(remoteCards, nextActiveId);
      }
    } finally {
      setSyncing(false);
    }
  }, [persistCards, session]);

  useEffect(() => {
    if (!session) return;
    const task = setTimeout(() => { void sync(); }, 0);
    return () => clearTimeout(task);
  }, [session?.user?.id, sync]);

  const setPrimaryCard = useCallback(async (id: string) => {
    const currentCards = cardsRef.current;
    if (!currentCards.some((item) => item.id === id)) return;
    if (id === activeCardIdRef.current) return;
    await persistCards(currentCards, id);
  }, [persistCards]);

  const createCard = useCallback(async (seed: Partial<MobileCard> = {}) => {
    const currentCards = cardsRef.current;
    if (currentCards.length >= MAX_CARDS) {
      setPublishError('You can save a maximum of five cards.');
      return null;
    }
    const palette = CARD_THEMES[currentCards.length % CARD_THEMES.length];
    const card = createMobileCard({ theme: palette, ...seed });
    const nextCards = [...currentCards, card];
    await persistCards(nextCards, card.id!);
    if (session?.access_token) {
      try {
        await saveRemoteCard(card);
      } catch {
        // Local card remains available even if sync fails.
      }
    }
    return card;
  }, [persistCards, saveRemoteCard, session?.access_token]);

  const updateCardById = useCallback(async (id: string, changes: Partial<MobileCard>) => {
    const current = cardsRef.current.find((item) => item.id === id);
    if (!current) return;
    const nextCard = normalizeCard({ ...current, ...changes, theme: normalizeThemeColor(changes.theme || current.theme) });
    const nextCards = cardsRef.current.map((item) => (item.id === id ? nextCard : item));
    await persistCards(nextCards);
    if (session?.access_token) {
      try {
        await saveRemoteCard(nextCard);
      } catch {
        // Local edits remain available offline.
      }
    }
  }, [persistCards, saveRemoteCard, session?.access_token]);

  const publishCard = useCallback(async (id = activeCardId) => {
    const supabase = getSupabase();
    const target = cards.find((item) => item.id === id) || activeCard;
    if (!supabase || !session) {
      setPublishError('Sign in to publish this card.');
      return false;
    }
    setPublishing(true);
    setPublishError('');
    try {
      const { data, error } = await supabase.rpc('publish_my_card', {
        p_slug: target.slug,
        p_full_name: target.name,
        p_job_title: target.role,
        p_company: target.company,
        p_bio: target.bio,
        p_theme_color: normalizeThemeColor(target.theme),
        p_profile_image_url: target.photo,
        p_company_logo_url: target.companyLogo,
        p_cover_image_url: target.coverPhoto,
        p_methods: target.methods.map((method, sortOrder) => ({ ...method, sortOrder })),
      });
      if (error) throw error;
      await updateCardById(target.id!, { id: String(data), status: 'published' });
      return true;
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Card publishing failed.');
      return false;
    } finally {
      setPublishing(false);
    }
  }, [activeCard, activeCardId, cards, session, updateCardById]);

  const getCardById = useCallback(
    (cardId: string) => cards.find((item) => item.id === cardId),
    [cards],
  );

  const cardPublicUrl = useCallback((target: MobileCard) => {
    const env = readEnv();
    return `${env?.publicCardBaseUrl || 'http://localhost:3000'}/c/${target.slug}`;
  }, []);

  const value = useMemo<CardValue>(() => {
    const env = readEnv();
    return {
      cards,
      card: activeCard,
      activeCardId,
      loading,
      syncing,
      publishing,
      publishError,
      publicUrl: cardPublicUrl(activeCard),
      canCreateCard: cards.length < MAX_CARDS,
      getCardById,
      cardPublicUrl,
      isPrimaryCard: (id) => id === activeCardId,
      setPrimaryCard,
      setActiveCard: setPrimaryCard,
      createCard,
      updateCard: (changes) => updateCardById(activeCard.id!, changes),
      updateCardById,
      addMethod: async (method) => updateCardById(activeCard.id!, {
        methods: [...activeCard.methods.filter((item) => item.type !== method.type), method],
      }),
      removeMethod: async (methodId) => updateCardById(activeCard.id!, {
        methods: activeCard.methods.filter((item) => item.id !== methodId),
      }),
      sync,
      publish: () => publishCard(activeCardId),
      publishCard,
    };
  }, [
    activeCard,
    activeCardId,
    cards,
    createCard,
    loading,
    publishCard,
    publishError,
    publishing,
    setPrimaryCard,
    sync,
    syncing,
    updateCardById,
    getCardById,
    cardPublicUrl,
  ]);

  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

export function useCard() {
  const value = useContext(CardContext);
  if (!value) throw new Error('useCard must be used inside CardProvider');
  return value;
}
