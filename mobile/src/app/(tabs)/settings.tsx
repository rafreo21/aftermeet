import { router } from 'expo-router';
import { Bell, CalendarCheck, CaretRight, CheckCircle, ClockCounterClockwise, EnvelopeSimple, ListChecks, ShareNetwork } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Eyebrow, Panel, Screen, Title } from '@/components/ui';
import { SettingsSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { getSupabase } from '@/lib/supabase';
import { fetchFollowUps } from '@/features/follow-ups/follow-up-api';
import {
  deviceNotificationsEnabled,
  followUpReminderTime,
  notificationPermissionGranted,
  REMINDER_TIME_OPTIONS,
  requestNotificationPermission,
  setDeviceNotificationsEnabled,
  setFollowUpReminderTime,
  syncFollowUpNotifications,
  type ReminderTime,
} from '@/features/notifications/notification-service';
import {
  deactivatePushToken,
  registerPushToken,
} from '@/features/notifications/push-token-service';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationType,
} from '@/features/notifications/notification-center-api';
import { colors, spacing } from '@/theme/tokens';

const NOTIFICATION_TYPE_ROWS: Array<{ type: NotificationType; icon: typeof Bell; label: string; hint: string }> = [
  { type: 'review_ready', icon: CheckCircle, label: 'Transcript ready', hint: 'A capture is ready for your review' },
  { type: 'follow_up_due', icon: CalendarCheck, label: 'Follow-up due', hint: 'A reviewed follow-up is due today' },
  { type: 'follow_up_overdue', icon: ClockCounterClockwise, label: 'Follow-up overdue', hint: 'A reviewed follow-up is overdue' },
  { type: 'shared_meeting_update', icon: ShareNetwork, label: 'Shared meeting updates', hint: 'A guest commits to their own follow-up' },
];

export default function SettingsScreen() {
  const { session, configured, signOut, loading } = useAuth();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [remindersSaving, setRemindersSaving] = useState(false);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [devicePermission, setDevicePermission] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [reminderTime, setReminderTime] = useState<ReminderTime>('09:00');
  const [typePreferences, setTypePreferences] = useState<NotificationPreferences | null>(null);
  const [typePreferencesSaving, setTypePreferencesSaving] = useState<NotificationType | null>(null);

  useEffect(() => {
    if (!session) return;
    const supabase = getSupabase();
    void supabase?.rpc('get_my_reminder_preference').then(({ data }) => {
      if (typeof data === 'boolean') setRemindersEnabled(data);
    });
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) {
      void Promise.resolve().then(() => setTypePreferences(null));
      return;
    }
    void fetchNotificationPreferences(session.access_token).then(setTypePreferences).catch(() => undefined);
  }, [session]);

  async function toggleNotificationType(type: NotificationType, value: boolean) {
    if (!session?.access_token || !typePreferences) return;
    const next = { ...typePreferences, [type]: value };
    setTypePreferences(next);
    setTypePreferencesSaving(type);
    try {
      await updateNotificationPreferences(session.access_token, next);
    } catch {
      setTypePreferences(typePreferences);
    } finally {
      setTypePreferencesSaving(null);
    }
  }

  useEffect(() => {
    void Promise.all([
      deviceNotificationsEnabled(),
      notificationPermissionGranted(),
      followUpReminderTime(),
    ]).then(([enabled, granted, storedReminderTime]) => {
      setDeviceEnabled(enabled && granted);
      setDevicePermission(granted);
      setReminderTime(storedReminderTime);
    });
  }, []);

  async function chooseReminderTime(value: ReminderTime) {
    setReminderTime(value);
    await setFollowUpReminderTime(value);
    if (deviceEnabled && session?.access_token) {
      const followUps = await fetchFollowUps(session.access_token);
      await syncFollowUpNotifications(followUps);
    }
    setNotificationMessage(`Device reminders will arrive at ${value} on their due date.`);
  }

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
        if (session?.access_token) void deactivatePushToken(session.access_token);
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
        void registerPushToken(session.access_token);
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
          {deviceEnabled ? (
            <View style={styles.reminderTimeBlock}>
              <Text style={styles.preferenceTitle}>Reminder time</Text>
              <View style={styles.reminderTimeOptions}>
                {REMINDER_TIME_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: reminderTime === option }}
                    onPress={() => void chooseReminderTime(option)}
                    style={({ pressed }) => [
                      styles.reminderTimeOption,
                      reminderTime === option && styles.reminderTimeOptionSelected,
                      pressed && styles.linkPanelPressed,
                    ]}>
                    <Text style={[
                      styles.reminderTimeText,
                      reminderTime === option && styles.reminderTimeTextSelected,
                    ]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.linkHint}>Uses this phone’s local time.</Text>
            </View>
          ) : null}
          {typePreferences ? (
            <>
              <View style={styles.preferenceDivider} />
              <View style={styles.notificationHeading}>
                <Text style={styles.preferenceTitle}>Notify me about</Text>
              </View>
              {NOTIFICATION_TYPE_ROWS.map((row) => (
                <View key={row.type} style={styles.reminderRow}>
                  <View style={styles.linkCopy}>
                    <View style={styles.linkTitleRow}>
                      <row.icon size={18} color={colors.ink} weight="bold" />
                      <Text style={styles.preferenceTitle}>{row.label}</Text>
                    </View>
                    <Text style={styles.linkHint}>{row.hint}</Text>
                  </View>
                  <Switch
                    accessibilityLabel={row.label}
                    value={typePreferences[row.type]}
                    disabled={typePreferencesSaving === row.type}
                    onValueChange={(value) => void toggleNotificationType(row.type, value)}
                    trackColor={{ false: colors.line, true: colors.accent }}
                    thumbColor={colors.white}
                  />
                </View>
              ))}
            </>
          ) : null}
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
        <Button
          variant="secondary"
          onPress={() => {
            if (session.access_token) void deactivatePushToken(session.access_token);
            signOut();
          }}>
          Sign out
        </Button>
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
  reminderTimeBlock: { gap: spacing.x2 },
  reminderTimeOptions: { flexDirection: 'row', gap: spacing.x2 },
  reminderTimeOption: {
    minWidth: 68,
    minHeight: 44,
    paddingHorizontal: spacing.x3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  reminderTimeOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  reminderTimeText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  reminderTimeTextSelected: { fontWeight: '900' },
  statusMessage: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  statusError: { color: colors.danger },
  statusRow: { gap: spacing.x2 },
  settingsLink: { color: colors.ink, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  linkCopy: { flex: 1, gap: 6 },
  linkTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  linkHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
