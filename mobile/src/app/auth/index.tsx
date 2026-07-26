import { router } from 'expo-router';
import { ArrowRight, EnvelopeSimple, X } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Eyebrow, Screen, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AuthScreen() {
  const { signIn, verifyEmailCode, configured, session } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (session) router.replace('/(tabs)');
  }, [session]);

  async function submitEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage('Enter a valid email address.');
    setLoading(true);
    setMessage('');
    const result = await signIn(email);
    setLoading(false);
    if (result.error) return setMessage(result.error);
    setStep('code');
    setMessage('Check your email for your 6-digit sign-in code.');
  }

  async function submitCode() {
    setLoading(true);
    setMessage('');
    const result = await verifyEmailCode(email, code);
    setLoading(false);
    if (result.error) return setMessage(result.error);
    router.replace('/(tabs)');
  }

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.top}>
        <Eyebrow>Welcome</Eyebrow>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityLabel="Close sign in">
          <X size={20} color={colors.ink} />
        </Pressable>
      </View>

      <Title>{step === 'email' ? 'Sign in or sign up in seconds.' : 'Enter your sign-in code.'}</Title>
      <Body>
        {step === 'email'
          ? 'We’ll email you a 6-digit sign-in code.'
          : 'Enter the 6-digit code we sent to your email.'}
      </Body>

      {step === 'email' ? (
        <>
          <View style={styles.field}>
            <EnvelopeSimple size={20} color={colors.muted} />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </View>
          {message ? <Text style={[styles.message, message.startsWith('Check') && styles.success]}>{message}</Text> : null}
          <Button loading={loading} disabled={!configured} onPress={submitEmail}>
            Continue <ArrowRight size={18} color={colors.ink} />
          </Button>
          <Button variant="secondary" onPress={() => router.back()}>
            Continue in preview mode
          </Button>
        </>
      ) : (
        <>
          <View style={styles.field}>
            <TextInput
              autoCapitalize="none"
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={colors.muted}
              textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
              value={code}
              onChangeText={setCode}
              style={[styles.input, styles.codeInput]}
            />
          </View>
          {message ? <Text style={[styles.message, message.startsWith('Check') && styles.success]}>{message}</Text> : null}
          <Button loading={loading} disabled={!configured || code.replace(/\D/g, '').length < 6} onPress={submitCode}>
            Verify and continue
          </Button>
          <Button variant="ghost" loading={loading} onPress={submitEmail}>
            Resend code
          </Button>
          <Button variant="ghost" onPress={() => { setStep('email'); setCode(''); setMessage(''); }}>
            Use a different email
          </Button>
        </>
      )}

      {!configured && (
        <Text style={styles.config}>
          Authentication will activate after EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are added.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: colors.surface },
  field: { minHeight: 54, paddingHorizontal: spacing.x4, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, backgroundColor: colors.surface },
  input: { flex: 1, color: colors.ink, fontSize: 16 },
  codeInput: { letterSpacing: 8, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  message: { color: colors.danger, fontSize: 13 },
  success: { color: colors.ink },
  config: { color: colors.warning, fontSize: 12, lineHeight: 18 },
});
