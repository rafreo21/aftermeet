import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { defaultCard } from '@/features/card/default-card';
import type { ContactMethod, MobileCard } from '@/features/card/types';
import { updateQuickShareWidget } from '@/features/card/widget-sync';
import { readEnv } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

const STORAGE_KEY = 'aftermeet.mobile.card.v1';

type CardValue = {
  card: MobileCard;
  loading: boolean;
  syncing: boolean;
  publishing: boolean;
  publishError: string;
  publicUrl: string;
  updateCard: (changes: Partial<MobileCard>) => Promise<void>;
  addMethod: (method: ContactMethod) => Promise<void>;
  removeMethod: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  publish: () => Promise<boolean>;
};

const CardContext = createContext<CardValue | null>(null);

export function CardProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [card, setCard] = useState(defaultCard);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try { setCard({ ...defaultCard, ...JSON.parse(stored) }); } catch {}
      }
      setLoading(false);
    });
  }, []);

  const saveLocal = useCallback(async (next: MobileCard) => {
    setCard(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    await updateQuickShareWidget(next);
  }, []);

  const sync = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setSyncing(true);
    try {
      const { data: rawContext } = await supabase.rpc('get_my_app_context').single();
      const context = rawContext as { workspace_id?: string } | null;
      if (!context?.workspace_id) return;
      const { data: remote } = await supabase.from('cards').select('*, card_methods(*)').eq('workspace_id', context.workspace_id).maybeSingle();
      if (remote) {
        await saveLocal({
          id: remote.id,
          slug: remote.slug,
          name: remote.full_name,
          role: remote.job_title || '',
          company: remote.company || '',
          bio: remote.bio || '',
          theme: remote.theme_color,
          photo: remote.profile_image_url || '',
          companyLogo: remote.company_logo_url || '',
          coverPhoto: remote.cover_image_url || '',
          status: remote.status,
          methods: (remote.card_methods || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order).map((method: {
            id: string; method_type: ContactMethod['type']; value: string; label: string;
          }) => ({ id: method.id, type: method.method_type, value: method.value, label: method.label })),
        });
      }
    } finally {
      setSyncing(false);
    }
  }, [saveLocal, session]);

  useEffect(() => {
    const task = setTimeout(() => { void sync(); }, 0);
    return () => clearTimeout(task);
  }, [sync]);

  const publish = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !session) {
      setPublishError('Sign in to publish this card.');
      return false;
    }
    setPublishing(true);
    setPublishError('');
    try {
      const { data, error } = await supabase.rpc('publish_my_card', {
        p_slug: card.slug,
        p_full_name: card.name,
        p_job_title: card.role,
        p_company: card.company,
        p_bio: card.bio,
        p_theme_color: card.theme,
        p_profile_image_url: card.photo,
        p_company_logo_url: card.companyLogo,
        p_cover_image_url: card.coverPhoto,
        p_methods: card.methods.map((method, sortOrder) => ({ ...method, sortOrder })),
      });
      if (error) throw error;
      await saveLocal({ ...card, id: String(data), status: 'published' });
      return true;
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Card publishing failed.');
      return false;
    } finally {
      setPublishing(false);
    }
  }, [card, saveLocal, session]);

  const value = useMemo<CardValue>(() => {
    const env = readEnv();
    return {
      card,
      loading,
      syncing,
      publishing,
      publishError,
      publicUrl: `${env?.publicCardBaseUrl || 'http://localhost:3000'}/c/${card.slug}`,
      updateCard: async (changes) => saveLocal({ ...card, ...changes }),
      addMethod: async (method) => saveLocal({ ...card, methods: [...card.methods.filter((item) => item.type !== method.type), method] }),
      removeMethod: async (id) => saveLocal({ ...card, methods: card.methods.filter((item) => item.id !== id) }),
      sync,
      publish,
    };
  }, [card, loading, syncing, publishing, publishError, saveLocal, sync, publish]);

  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

export function useCard() {
  const value = useContext(CardContext);
  if (!value) throw new Error('useCard must be used inside CardProvider');
  return value;
}
