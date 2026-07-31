import { router } from 'expo-router';
import { Bell, CaretRight, EnvelopeSimple, ListChecks } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Eyebrow, Panel, Screen, Title } from '@/components/ui';
import { SettingsSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { getSupabase } from '@/lib/supabase';
import { fetchFollowUps } from '@/features/follow-ups/follow-up-api';
import {
  deviceNotificationsEnabled,
  notificationPermissionGranted,
  requestNotificationPermission,
  setDeviceNotificationsEnabled,
  syncFollowUpNotifications,
} from '@/features/notifications/notification-service';
import { colors, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const { session, configured, signOut, loading } = useAuth();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [remindersSaving, setRemindersSaving] = useState(false);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [devicePermission, setDevicePermission] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    const supabase = getSupabase();
    void supabase?.rpc('get_my_reminder_preference').then(({ data }) => {
      if (typeof data === 'boolean') setRemindersEnabled(data);
    });
  }, [session]);

  useEffect(() => {
    void Promise.all([
      deviceNotificationsEnabled(),
      notificationPermissionGranted(),
    ]).then(([enabled, granted]) => {
      setDeviceEnabled(enabled && granted);
      setDevicePermission(granted);
    });
  }, []);

  async function toggleReminders(value: boolean) {
    setRemindersEnabled(value);
    setRemindersSaving(true);
    try {
      const supabase = getSupabase();
      await supabase?.rpc('set_reminder_email_preference', { p_enabled: value });
    } catch {
      setRemindersEnabled(!value);
    } finally {
      setRemindersSaving(false);
    }
  }

  async function toggleDeviceNotifications(value: boolean) {
    setDeviceSaving(true);
    setNotificationMessage('');
    try {
      if (!value) {
        await setDeviceNotificationsEnabled(false);
        setDeviceEnabled(false);
        return;
      }

      const granted = await requestNotificationPermission();
      setDevicePermission(granted);
      if (!granted) {
        setDeviceEnabled(false);
        setNotificationMessage('Notifications are blocked. Enable them for AfterMeet in your device settings.');
        return;
      }

      await setDeviceNotificationsEnabled(true);
      setDeviceEnabled(true);
      if (session?.access_token) {
        const followUps = await fetchFollowUps(session.access_token);
        await syncFollowUpNotifications(followUps);
      }
      setNotificationMessage('Device reminders are on. AfterMeet will remind you when a follow-up is due.');
    } catch {
      setDeviceEnabled(false);
      setNotificationMessage('Could not enable device reminders. Please try again.');
    } finally {
      setDeviceSaving(false);
    }
  }

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

      {session ? (
        <Panel style={styles.notificationPanel}>
          <View style={styles.notificationHeading}>
            <Text style={styles.sectionTitle}>Notification preferences</Text>
            <Text style={styles.linkHint}>Choose how AfterMeet reminds you about follow-ups.</Text>
          </View>
          <View style={styles.reminderRow}>
            <View style={styles.linkCopy}>
              <View style={styles.linkTitleRow}>
                <EnvelopeSimple size={18} color={colors.ink} weight="bold" />
                <Text style={styles.preferenceTitle}>Email reminders</Text>
              </View>
              <Text style={styles.linkHint}>Email me when a follow-up becomes overdue</Text>
            </View>
            <Switch
              accessibilityLabel="Email me about overdue follow-ups"
              value={remindersEnabled}
              disabled={remindersSaving}
              onValueChange={(value) => void toggleReminders(value)}
              trackColor={{ false: colors.line, true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.preferenceDivider} />
          <View style={styles.reminderRow}>
            <View style={styles.linkCopy}>
              <View style={styles.linkTitleRow}>
                <Bell size={18} color={colors.ink} weight="bold" />
                <Text style={styles.preferenceTitle}>Device notifications</Text>
              </View>
              <Text style={styles.linkHint}>Remind me on this phone when my follow-ups are due</Text>
            </View>
            <Switch
              accessibilityLabel="Device follow-up notifications"
              value={deviceEnabled}
              disabled={deviceSaving}
              onValueChange={(value) => void toggleDeviceNotifications(value)}
              trackColor={{ false: colors.line, true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
          {notificationMessage ? (
            <View style={styles.statusRow}>
              <Text style={[styles.statusMessage, !devicePermission && styles.statusError]}>
                {notificationMessage}
              </Text>
              {!devicePermission ? (
                <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
                  <Text style={styles.settingsLink}>Open device settings</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Panel>
      ) : null}

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
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.x3 },
  notificationPanel: { gap: spacing.x4 },
  notificationHeading: { gap: spacing.x1 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  preferenceTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  preferenceDivider: { height: 1, backgroundColor: colors.line },
  statusMessage: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  statusError: { color: colors.danger },
  statusRow: { gap: spacing.x2 },
  settingsLink: { color: colors.ink, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  linkCopy: { flex: 1, gap: 6 },
  linkTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  linkHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
