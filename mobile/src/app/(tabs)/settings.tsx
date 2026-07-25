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
    <Panel><Text style={styles.label}>Widgets</Text><Text style={styles.value}>Quick Share</Text><Text style={styles.hint}>Widget deep links are configured for QR sharing and encounter capture.</Text></Panel>
  </Screen>;
}
const styles = StyleSheet.create({ header: { paddingTop: spacing.x5, gap: spacing.x3 }, label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, value: { marginTop: 8, color: colors.ink, fontSize: 17, fontWeight: '800' }, hint: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 18 } });
