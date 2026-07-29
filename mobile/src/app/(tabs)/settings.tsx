import { router } from 'expo-router';
import { CaretRight, ListChecks } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Eyebrow, Panel, Screen, Title } from '@/components/ui';
import { SettingsSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { colors, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const { session, configured, signOut, loading } = useAuth();

  if (loading) {
    return (
      <Screen>
        <SettingsSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>AfterMeet mobile</Eyebrow>
        <Title>Settings</Title>
        <Body>Manage your account, synchronization and mobile capabilities.</Body>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/settings/follow-ups')}
        style={({ pressed }) => [styles.linkPanel, pressed && styles.linkPanelPressed]}>
        <View style={styles.linkCopy}>
          <View style={styles.linkTitleRow}>
            <ListChecks size={18} color={colors.ink} weight="bold" />
            <Text style={styles.label}>Follow-ups</Text>
          </View>
          <Text style={styles.linkHint}>Current actions and completed follow-ups</Text>
        </View>
        <CaretRight size={18} color={colors.muted} weight="bold" />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/settings/connected-accounts')}
        style={({ pressed }) => [styles.linkPanel, pressed && styles.linkPanelPressed]}>
        <View style={styles.linkCopy}>
          <Text style={styles.label}>Connected accounts</Text>
          <Text style={styles.linkHint}>Google, Microsoft, and future integrations</Text>
        </View>
        <CaretRight size={18} color={colors.muted} weight="bold" />
      </Pressable>

      <Panel>
        <Text style={styles.label}>Account</Text>
        <Text style={styles.value}>{session?.user.email || 'Preview mode'}</Text>
        <Text style={styles.hint}>
          {configured ? session ? 'Secure session active' : 'Supabase connected · sign in to sync' : 'Add the mobile environment variables to enable sync'}
        </Text>
      </Panel>
      {!session ? (
        <Button onPress={() => router.push('/auth')}>Sign in or sign up</Button>
      ) : (
        <Button variant="secondary" onPress={signOut}>Sign out</Button>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.x5, gap: spacing.x3 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  value: { marginTop: 8, color: colors.ink, fontSize: 17, fontWeight: '800' },
  hint: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 18 },
  linkPanel: {
    minHeight: 72,
    padding: spacing.x5,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.x3,
  },
  linkPanelPressed: { opacity: 0.82 },
  linkCopy: { flex: 1, gap: 6 },
  linkTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  linkHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
