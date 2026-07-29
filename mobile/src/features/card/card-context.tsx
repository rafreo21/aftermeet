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
import { isPreviewCard } from '@/features/card/default-card';
import type { ContactMethod, MobileCard } from '@/features/card/types';
import { syncCardToolsForCard } from '@/features/card/card-tools-sync';
import { uploadCardImagesForPublish } from '@/features/card/card-image-upload';
import { describePublishError, formatPublishError, type PublishCardResult, validateCardForPublish } from '@/features/card/publish-card';
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
  publish: () => Promise<PublishCardResult>;
  publishCard: (id?: string, cardOverride?: MobileCard) => Promise<PublishCardResult>;
  deleteCard: (id: string) => Promise<boolean>;
};

const CardContext = createContext<CardValue | null>(null);

function normalizeCard(card: MobileCard): MobileCard {
  const showCompanyDetails = card.showCompanyDetails ?? (card as { showCompanyLogo?: boolean }).showCompanyLogo ?? true;
  return {
    ...card,
    showCompanyDetails,
    theme: normalizeThemeColor(card.theme),
  };
}

function cardsSnapshot(cards: MobileCard[]) {
  return JSON.stringify(cards.map(normalizeCard));
}

function mapStoredCards(raw: unknown): MobileCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_CARDS).map((item) => normalizeCard({ ...createMobileCard(), ...(item as MobileCard) }));
}

function withoutPreviewCards(items: MobileCard[]) {
  return items.filter((item) => !isPreviewCard(item));
}

export function CardProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [cards, setCards] = useState<MobileCard[]>([]);
  const [activeCardId, setActiveCardIdState] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  const cardsRef = useRef(cards);
  const activeCardIdRef = useRef(activeCardId);
  cardsRef.current = cards;
  activeCardIdRef.current = activeCardId;

  const visibleCards = useMemo(() => withoutPreviewCards(cards), [cards]);

  const activeCard = useMemo(
    () => visibleCards.find((item) => item.id === activeCardId) || visibleCards[0] || createMobileCard(),
    [activeCardId, visibleCards],
  );

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CARDS_STORAGE_KEY),
      AsyncStorage.getItem(LEGACY_CARD_KEY),
      AsyncStorage.getItem(ACTIVE_CARD_KEY),
    ]).then(([storedCards, legacyCard, storedActiveId]) => {
      let nextCards = withoutPreviewCards(mapStoredCards(storedCards ? JSON.parse(storedCards) : []));
      if (!nextCards.length && legacyCard) {
        try {
          const legacy = normalizeCard({ ...createMobileCard(), ...JSON.parse(legacyCard) as MobileCard });
          if (!isPreviewCard(legacy)) nextCards = [legacy];
        } catch {}
      }
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
    if (active) {
      const env = readEnv();
      const urlForCard = (target: MobileCard) =>
        `${env?.publicCardBaseUrl || 'http://localhost:3000'}/c/${target.slug}`;
      await syncCardToolsForCard(normalized, urlForCard, session?.access_token, active);
    }
  }, [session?.access_token]);

  const saveRemoteCard = useCallback(async (card: MobileCard, options?: { strictImages?: boolean }) => {
    if (!session?.access_token) return card;

    async function persistPayload(payload: MobileCard) {
      const response = await mobileFetch('/api/cards', session!.access_token!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mobileCardToLibraryPayload(payload)),
      });
      if (!response.ok) {
        const responsePayload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(responsePayload?.error || 'We couldn’t save this card.');
      }
      return payload;
    }

    let payload = card;
    await persistPayload(payload);

    if (!card.id) return payload;

    try {
      const uploaded = await uploadCardImagesForPublish(session.access_token, card.id, {
        photo: card.photo || '',
        coverPhoto: card.coverPhoto || '',
        companyLogo: card.showCompanyDetails !== false ? (card.companyLogo || '') : '',
      });
      const imagesChanged = uploaded.photo !== payload.photo
        || uploaded.coverPhoto !== payload.coverPhoto
        || uploaded.companyLogo !== payload.companyLogo;
      if (imagesChanged) {
        payload = { ...card, ...uploaded };
        await persistPayload(payload);
      }
    } catch (error) {
      if (options?.strictImages) {
        throw error instanceof Error ? error : new Error('Could not upload card images.');
      }
    }

    return payload;
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
        return;
      }

      const localCards = withoutPreviewCards(cardsRef.current);
      if (!localCards.length || !session.access_token) return;

      const uploaded: MobileCard[] = [];
      for (const card of localCards) {
        try {
          uploaded.push(await saveRemoteCard(card));
        } catch {
          uploaded.push(card);
        }
      }
      if (uploaded.length) {
        const nextActiveId = getActiveCardId(uploaded, activeCardIdRef.current);
        await persistCards(uploaded, nextActiveId);
      }
    } finally {
      setSyncing(false);
    }
  }, [persistCards, saveRemoteCard, session]);

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
        const saved = await saveRemoteCard(nextCard);
        if (saved) {
          const merged = { ...nextCard, photo: saved.photo, coverPhoto: saved.coverPhoto, companyLogo: saved.companyLogo };
          if (merged.photo !== nextCard.photo || merged.coverPhoto !== nextCard.coverPhoto || merged.companyLogo !== nextCard.companyLogo) {
            const syncedCards = cardsRef.current.map((item) => (item.id === id ? merged : item));
            await persistCards(syncedCards);
          }
        }
      } catch {
        // Local edits remain available offline.
      }
      if (nextCard.status === 'published') {
        const synced = cardsRef.current.find((item) => item.id === id) || nextCard;
        await syncCardToolsForCard(
          cardsRef.current,
          (target) => `${readEnv()?.publicCardBaseUrl || 'http://localhost:3000'}/c/${target.slug}`,
          session.access_token,
          synced,
        );
      }
    }
  }, [persistCards, saveRemoteCard, session?.access_token]);

  const cardPublicUrl = useCallback((target: MobileCard) => {
    const env = readEnv();
    return `${env?.publicCardBaseUrl || 'http://localhost:3000'}/c/${target.slug}`;
  }, []);

  const publishCard = useCallback(async (id = activeCardId, cardOverride?: MobileCard): Promise<PublishCardResult> => {
    const supabase = getSupabase();
    const target = cardOverride
      ?? cardsRef.current.find((item) => item.id === id)
      ?? cardsRef.current.find((item) => item.id === activeCardIdRef.current)
      ?? activeCard;
    if (!supabase || !session) {
      const failure = describePublishError('Sign in to publish this card.');
      setPublishError(failure.message);
      return { ok: false, ...failure };
    }
    if (!target.id) {
      const failure = describePublishError('Save this card before publishing.');
      setPublishError(failure.message);
      return { ok: false, ...failure };
    }
    const validationError = validateCardForPublish(target);
    if (validationError) {
      const failure = describePublishError(validationError);
      setPublishError(failure.message);
      return { ok: false, ...failure };
    }

      setPublishing(true);
      setPublishError('');
      try {
        let publishTarget = target;
        if (session.access_token) {
          publishTarget = await saveRemoteCard(target, { strictImages: true }) || target;
        }

        const { data, error } = await supabase.rpc('publish_my_card', {
          p_slug: publishTarget.slug,
          p_full_name: publishTarget.name,
          p_job_title: publishTarget.role,
          p_company: publishTarget.company,
          p_bio: publishTarget.bio,
          p_theme_color: normalizeThemeColor(publishTarget.theme),
          p_profile_image_url: publishTarget.photo || '',
          p_company_logo_url: publishTarget.showCompanyDetails !== false ? (publishTarget.companyLogo || '') : '',
          p_cover_image_url: publishTarget.coverPhoto || '',
          p_show_company_details: publishTarget.showCompanyDetails !== false,
          p_methods: publishTarget.methods.map((method, sortOrder) => ({ ...method, sortOrder })),
        });
        if (error) throw error;

        const publishedCard = normalizeCard({
          ...publishTarget,
          id: String(data),
          status: 'published',
        });
        const nextCards = cardsRef.current.map((item) => (
          item.id === target.id ? publishedCard : item
        ));
        await persistCards(nextCards, activeCardIdRef.current);

        void syncCardToolsForCard(
          nextCards,
          (card) => `${readEnv()?.publicCardBaseUrl || 'http://localhost:3000'}/c/${card.slug}`,
          session.access_token,
          publishedCard,
        );

        const publicUrl = cardPublicUrl(publishedCard);
        return { ok: true, publicUrl };
    } catch (error) {
      const message = formatPublishError(error);
      const failure = describePublishError(message);
      setPublishError(failure.message);
      return { ok: false, ...failure };
    } finally {
      setPublishing(false);
    }
  }, [activeCard, activeCardId, cardPublicUrl, saveRemoteCard, session, updateCardById]);

  const deleteCard = useCallback(async (id: string) => {
    const currentCards = cardsRef.current;
    const target = currentCards.find((item) => item.id === id);
    if (!target?.id) return false;

    const supabase = getSupabase();
    if (supabase && session) {
      const { error } = await supabase.from('cards').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
    }

    let nextCards = currentCards.filter((item) => item.id !== id);
    if (!nextCards.length) nextCards = [createMobileCard()];
    const nextActiveId = getActiveCardId(
      nextCards,
      activeCardIdRef.current === id ? nextCards[0]?.id || '' : activeCardIdRef.current,
    );
    await persistCards(nextCards, nextActiveId);
    return true;
  }, [persistCards, session]);

  const getCardById = useCallback(
    (cardId: string) => cards.find((item) => item.id === cardId),
    [cards],
  );

  const value = useMemo<CardValue>(() => {
    const env = readEnv();
    return {
      cards: visibleCards,
      card: activeCard,
      activeCardId,
      loading,
      syncing,
      publishing,
      publishError,
      publicUrl: cardPublicUrl(activeCard),
      canCreateCard: visibleCards.length < MAX_CARDS,
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
      deleteCard,
    };
  }, [
    activeCard,
    activeCardId,
    visibleCards,
    createCard,
    deleteCard,
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
