import { router, useFocusEffect } from 'expo-router';
import { Bell, BellSlash, Trash } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton, Body, Button, Eyebrow, Panel, Screen, Title } from '@/components/ui';
import {
  clearNotificationHistory,
  deviceNotificationsEnabled,
  notificationPermissionGranted,
  readNotificationHistory,
  markAllNotificationsRead,
  type NotificationHistoryItem,
} from '@/features/notifications/notification-service';
import { colors, radius, spacing } from '@/theme/tokens';

export default function NotificationsScreen() {
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [granted, setGranted] = useState(false);

  const load = useCallback(async () => {
    const [nextHistory, nextEnabled, nextGranted] = await Promise.all([
      readNotificationHistory(),
      deviceNotificationsEnabled(),
      notificationPermissionGranted(),
    ]);
    setHistory(nextHistory);
    setEnabled(nextEnabled);
    setGranted(nextGranted);
    if (nextHistory.some((item) => !item.readAt)) {
      await markAllNotificationsRead();
      setHistory(nextHistory.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function clearHistory() {
    await clearNotificationHistory();
    setHistory([]);
  }

  return (
    <Screen reserveTabBar={false}>
      <BackButton />
      <View style={styles.header}>
        <Eyebrow>Notifications</Eyebrow>
        <Title>Notifications</Title>
        <Body>Time-sensitive reminders live here. Open Follow-ups to do the work.</Body>
      </View>

      {!enabled || !granted ? (
        <Panel style={styles.summary}>
          <View style={styles.summaryIcon}>
            <BellSlash size={24} color={colors.muted} weight="bold" />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Device reminders are off</Text>
            <Text style={styles.summaryDetail}>Turn them on from Settings to get due-date alerts.</Text>
          </View>
        </Panel>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent alerts</Text>
        {history.length ? (
          <Pressable accessibilityRole="button" onPress={() => void clearHistory()} style={styles.clearButton}>
            <Trash size={15} color={colors.muted} weight="bold" />
            <Text style={styles.clearLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {history.length ? history.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item.id}
          onPress={() => router.push(item.route as '/settings/follow-ups')}
          style={({ pressed }) => [styles.notification, pressed && styles.pressed]}>
          <View style={styles.notificationIcon}>
            <Bell size={18} color={colors.ink} weight="bold" />
          </View>
          <View style={styles.notificationCopy}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            {item.body ? <Text style={styles.notificationBody}>{item.body}</Text> : null}
            <Text style={styles.notificationTime}>{new Date(item.receivedAt).toLocaleString()}</Text>
          </View>
        </Pressable>
      )) : (
        <Panel style={styles.empty}>
          <View style={styles.notificationIcon}>
            <Bell size={20} color={colors.ink} weight="bold" />
          </View>
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Body>When a follow-up reminder arrives, it will also appear here.</Body>
          <Button variant="secondary" onPress={() => router.push('/settings/follow-ups')}>View follow-ups</Button>
        </Panel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.x3 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.x4 },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.round, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, gap: spacing.x1 },
  summaryTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  summaryDetail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.x2 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.x1, paddingVertical: spacing.x2, paddingHorizontal: spacing.x3 },
  clearLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  notification: { flexDirection: 'row', gap: spacing.x3, padding: spacing.x4, borderRadius: radius.medium, backgroundColor: colors.surface },
  pressed: { opacity: 0.78 },
  notificationIcon: { width: 40, height: 40, borderRadius: radius.small, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, gap: spacing.x1 },
  notificationTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  notificationBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  notificationTime: { color: colors.muted, fontSize: 11, marginTop: spacing.x1 },
  empty: { alignItems: 'flex-start', gap: spacing.x3 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
});
