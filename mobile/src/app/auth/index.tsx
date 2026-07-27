import { router } from 'expo-router';
import { ArrowRight, EnvelopeSimple } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Body, Button, PageHeader, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { consumeAuthReturnPath } from '@/features/encounters/capture-draft';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AuthScreen() {
  const { signIn, verifyEmailCode, configured, session } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    void consumeAuthReturnPath().then((path) => {
      if (path) router.replace(path as '/capture');
      else router.replace('/(tabs)');
    });
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
    void consumeAuthReturnPath().then((path) => {
      if (path) router.replace(path as '/capture');
      else router.replace('/(tabs)');
    });
  }

  return (
    <Screen scroll={false} style={styles.screen} edges={['top', 'bottom']} reserveTabBar={false}>
      <View style={styles.brandWrap}>
        <BrandMark size={44} />
      </View>
      <PageHeader
        eyebrow="Welcome"
        title={step === 'email' ? 'Sign in or sign up in seconds.' : 'Enter your sign-in code.'}
        titleStyle={styles.authTitle}
      />
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
  brandWrap: { alignItems: 'flex-start', marginBottom: spacing.x2 },
  authTitle: { fontSize: 34, lineHeight: 36, letterSpacing: -1.2 },
  field: { minHeight: 54, paddingHorizontal: spacing.x4, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, backgroundColor: colors.surface },
  input: { flex: 1, color: colors.ink, fontSize: 16 },
  codeInput: { letterSpacing: 8, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  message: { color: colors.danger, fontSize: 13 },
  success: { color: colors.ink },
  config: { color: colors.warning, fontSize: 12, lineHeight: 18 },
});
