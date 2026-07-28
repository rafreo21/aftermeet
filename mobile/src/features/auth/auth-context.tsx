import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { createAuthRedirectUri } from '@/lib/auth-redirect';
import { describeOtpDeliveryError } from '@/lib/otp-delivery-error';
import { completeAuthSessionFromUrl, readLaunchAuthUrl } from '@/lib/auth-session-url';
import { readMobileAuthRedirectUris } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { consumeAuthReturnPath } from '@/features/encounters/capture-draft';

type AuthValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  redirectUri: string | null;
  signIn: (email: string) => Promise<{ error?: string; sent?: boolean }>;
  verifyEmailCode: (email: string, token: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const supabase = getSupabase();
  const redirectUris = readMobileAuthRedirectUris();
  const redirectUri = redirectUris?.nativeCallbackUri ?? (supabase ? createAuthRedirectUri() : null);
  const emailRedirectUri = redirectUris?.emailRedirectUri ?? redirectUri;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const sessionTimeout = setTimeout(() => setLoading(false), 5000);

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'SIGNED_IN' && nextSession) {
        void consumeAuthReturnPath().then((path) => {
          if (path) router.replace(path as '/capture');
          else router.replace('/(tabs)');
        });
      }
    });

    async function handleUrl(url: string | null) {
      if (!url || !supabase) return;
      const result = await completeAuthSessionFromUrl(supabase, url);
      if (result.ok) {
        void consumeAuthReturnPath().then((path) => {
          if (path) router.replace(path as '/capture');
          else router.replace('/(tabs)');
        });
      }
    }

    readLaunchAuthUrl().then(handleUrl);
    const linking = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      clearTimeout(sessionTimeout);
      data.subscription.unsubscribe();
      linking.remove();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) return;
    supabase.rpc('provision_personal_workspace').then(() => {
      void supabase.rpc('link_people_connections_for_email');
    });
  }, [session, supabase]);

  const value = useMemo<AuthValue>(() => ({
    session,
    loading,
    configured: Boolean(supabase),
    redirectUri,
    signIn: async (email) => {
      if (!supabase) return { error: 'Connect the mobile environment to Supabase first.' };
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      return error ? { error: describeOtpDeliveryError(error) } : { sent: true };
    },
    verifyEmailCode: async (email, token) => {
      if (!supabase) return { error: 'Connect the mobile environment to Supabase first.' };
      const cleaned = token.replace(/\D/g, '');
      if (cleaned.length !== 6) return { error: 'Enter the 6-digit code from your email.' };
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleaned,
        type: 'email',
      });
      return error ? { error: error.message } : {};
    },
    signOut: async () => { await supabase?.auth.signOut(); },
  }), [session, loading, supabase, redirectUri, emailRedirectUri]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
