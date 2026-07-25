import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { getSupabase } from '@/lib/supabase';

type AuthValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string) => Promise<{ error?: string; sent?: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    const linking = Linking.addEventListener('url', async ({ url }) => {
      const parsed = Linking.parse(url);
      const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
      if (code) await supabase.auth.exchangeCodeForSession(code);
    });
    return () => {
      data.subscription.unsubscribe();
      linking.remove();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) return;
    supabase.rpc('provision_personal_workspace').then(() => {
      // Provisioning is idempotent and ensures every signed-in user can sync.
    });
  }, [session, supabase]);

  const value = useMemo<AuthValue>(() => ({
    session,
    loading,
    configured: Boolean(supabase),
    signIn: async (email) => {
      if (!supabase) return { error: 'Connect the mobile environment to Supabase first.' };
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: Linking.createURL('/auth/callback'), shouldCreateUser: true },
      });
      return error ? { error: error.message } : { sent: true };
    },
    signOut: async () => { await supabase?.auth.signOut(); },
  }), [session, loading, supabase]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
