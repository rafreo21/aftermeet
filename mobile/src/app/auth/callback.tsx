import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    let active = true;

    async function finish() {
      const supabase = getSupabase();
      const rawCode = params.code;
      const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

      if (!supabase) {
        if (active) setMessage('Supabase is not configured.');
        return;
      }
      if (!code) {
        if (active) setMessage('No sign-in code found. Request a new link or enter the 6-digit code.');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;

      if (error) {
        setMessage(error.message || 'That sign-in link expired. Request a new one.');
        return;
      }

      router.replace('/(tabs)');
    }

    finish();
    return () => {
      active = false;
    };
  }, [params.code]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={colors.ink} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.x4, backgroundColor: colors.canvas, padding: spacing.x5 },
  message: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
