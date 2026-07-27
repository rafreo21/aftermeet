import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Eyebrow, Panel, Screen, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { colors, spacing } from '@/theme/tokens';
export default function SettingsScreen() {
  const { session, configured, signOut } = useAuth();
  return <Screen><View style={styles.header}><Eyebrow>AfterMeet mobile</Eyebrow><Title>Settings</Title><Body>Manage your account, synchronization and mobile capabilities.</Body></View>
    <Panel><Text style={styles.label}>Account</Text><Text style={styles.value}>{session?.user.email || 'Preview mode'}</Text><Text style={styles.hint}>{configured ? session ? 'Secure session active' : 'Supabase connected · sign in to sync' : 'Add the mobile environment variables to enable sync'}</Text></Panel>
    {!session ? <Button onPress={() => router.push('/auth')}>Sign in or sign up</Button> : <Button variant="secondary" onPress={signOut}>Sign out</Button>}
    <Panel><Text style={styles.label}>Quick tools</Text><Text style={styles.value}>Wallet, NFC, signature, widget</Text><Text style={styles.hint}>Everything you need to use your card from your phone.</Text><Button variant="secondary" onPress={() => router.push('/card-tools')}>Open card tools</Button></Panel>
  </Screen>;
}
const styles = StyleSheet.create({ header: { paddingTop: spacing.x5, gap: spacing.x3 }, label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, value: { marginTop: 8, color: colors.ink, fontSize: 17, fontWeight: '800' }, hint: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 18 } });
