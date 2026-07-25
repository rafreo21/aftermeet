import { router } from 'expo-router';
import { ArrowRight, EnvelopeSimple, X } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Eyebrow, Screen, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AuthScreen() {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage('Enter a valid email address.');
    setLoading(true);
    const result = await signIn(email);
    setLoading(false);
    setMessage(result.error || 'Check your email for a secure sign-in link.');
  }

  return <Screen scroll={false} style={styles.screen}><View style={styles.top}><Eyebrow>Welcome</Eyebrow><Pressable onPress={() => router.back()} style={styles.close}><X size={20} color={colors.ink} /></Pressable></View><Title>Sign in or sign up in seconds.</Title><Body>We’ll send a secure, single-use link to your email.</Body>
    <View style={styles.field}><EnvelopeSimple size={20} color={colors.muted} /><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} style={styles.input} /></View>
    {message ? <Text style={[styles.message, message.startsWith('Check') && styles.success]}>{message}</Text> : null}
    <Button loading={loading} disabled={!configured} onPress={submit}>Continue <ArrowRight size={18} color={colors.ink} /></Button>
    {!configured && <Text style={styles.config}>Authentication will activate after EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are added.</Text>}
  </Screen>;
}
const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: colors.surface },
  field: { minHeight: 54, paddingHorizontal: spacing.x4, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, backgroundColor: colors.surface },
  input: { flex: 1, color: colors.ink, fontSize: 16 },
  message: { color: colors.danger, fontSize: 13 },
  success: { color: colors.ink },
  config: { color: colors.warning, fontSize: 12, lineHeight: 18 },
});
