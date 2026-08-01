import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { FollowUpItem } from '@/features/follow-ups/follow-up-api';

const ENABLED_KEY = 'aftermeet-device-notifications-enabled-v1';
const SCHEDULE_KEY = 'aftermeet-follow-up-notification-schedule-v1';
const HISTORY_KEY = 'aftermeet-notification-history-v1';
const REMINDER_TIME_KEY = 'aftermeet-follow-up-reminder-time-v1';
const CHANNEL_ID = 'follow-ups';
const MAX_HISTORY = 40;

type ScheduledReminder = {
  identifier: string;
  dueAt: string;
  reminderTime: string;
};

export const REMINDER_TIME_OPTIONS = ['09:00', '12:00', '17:00'] as const;
export type ReminderTime = typeof REMINDER_TIME_OPTIONS[number];

export type NotificationHistoryItem = {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  route: string;
  readAt?: string;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function followUpKey(item: FollowUpItem) {
  return `${item.encounterId}:${item.actionId}`;
}

function reminderDate(dueAt: string, reminderTime: ReminderTime) {
  const due = new Date(`${dueAt.slice(0, 10)}T${reminderTime}:00`);
  if (Number.isNaN(due.getTime())) return null;
  if (due.getTime() <= Date.now()) return new Date(Date.now() + 5_000);
  return due;
}

export async function followUpReminderTime(): Promise<ReminderTime> {
  const stored = await AsyncStorage.getItem(REMINDER_TIME_KEY);
  return REMINDER_TIME_OPTIONS.includes(stored as ReminderTime) ? stored as ReminderTime : '09:00';
}

export async function setFollowUpReminderTime(value: ReminderTime) {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, value);
}

async function readSchedule(): Promise<Record<string, ScheduledReminder>> {
  try {
    return JSON.parse(await AsyncStorage.getItem(SCHEDULE_KEY) || '{}') as Record<string, ScheduledReminder>;
  } catch {
    return {};
  }
}

async function writeSchedule(schedule: Record<string, ScheduledReminder>) {
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

export async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Follow-up reminders',
    description: 'Reminders for follow-ups you chose in AfterMeet.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: '#9FE870',
    showBadge: true,
  });
}

export async function notificationPermissionGranted() {
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestNotificationPermission() {
  await configureNotificationChannel();
  const permission = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function deviceNotificationsEnabled() {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

export async function setDeviceNotificationsEnabled(enabled: boolean) {
  await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
  if (!enabled) await clearFollowUpNotifications();
}

export async function clearFollowUpNotifications() {
  const schedule = await readSchedule();
  await Promise.all(Object.values(schedule).map((item) =>
    Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => undefined),
  ));
  await writeSchedule({});
  await Notifications.setBadgeCountAsync(0).catch(() => false);
}

export async function syncFollowUpNotifications(items: FollowUpItem[]) {
  if (!await deviceNotificationsEnabled() || !await notificationPermissionGranted()) return;
  await configureNotificationChannel();

  const open = items.filter((item) => item.owner === 'me' && item.status !== 'completed');
  const withDueDate = open.filter((item) => item.dueAt.trim());
  const previous = await readSchedule();
  const next: Record<string, ScheduledReminder> = {};
  const reminderTime = await followUpReminderTime();

  for (const item of withDueDate) {
    const key = followUpKey(item);
    const existing = previous[key];
    if (existing?.dueAt === item.dueAt && existing.reminderTime === reminderTime) {
      next[key] = existing;
      continue;
    }
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing.identifier).catch(() => undefined);
    }
    const date = reminderDate(item.dueAt, reminderTime);
    if (!date) continue;
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: `aftermeet-followup-${item.encounterId}-${item.actionId}`,
      content: {
        title: `Follow up with ${item.personName.trim() || 'your connection'}`,
        body: item.title.trim() || 'You have a follow-up waiting in AfterMeet.',
        sound: 'default',
        badge: open.length,
        data: {
          type: 'follow-up',
          route: '/settings/follow-ups',
          encounterId: item.encounterId,
          actionId: item.actionId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    next[key] = { identifier, dueAt: item.dueAt, reminderTime };
  }

  for (const [key, existing] of Object.entries(previous)) {
    if (!next[key]) {
      await Notifications.cancelScheduledNotificationAsync(existing.identifier).catch(() => undefined);
    }
  }

  await writeSchedule(next);
  await Notifications.setBadgeCountAsync(open.length).catch(() => false);
}

export async function recordNotification(notification: Notifications.Notification) {
  const content = notification.request.content;
  const data = content.data as { route?: unknown } | undefined;
  const item: NotificationHistoryItem = {
    id: notification.request.identifier,
    title: content.title || 'AfterMeet reminder',
    body: content.body || '',
    receivedAt: new Date().toISOString(),
    route: typeof data?.route === 'string' ? data.route : '/settings/follow-ups',
  };
  const current = await readNotificationHistory();
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([
    item,
    ...current.filter((entry) => entry.id !== item.id),
  ].slice(0, MAX_HISTORY)));
}

export async function readNotificationHistory(): Promise<NotificationHistoryItem[]> {
  try {
    return JSON.parse(await AsyncStorage.getItem(HISTORY_KEY) || '[]') as NotificationHistoryItem[];
  } catch {
    return [];
  }
}

export async function clearNotificationHistory() {
  await AsyncStorage.removeItem(HISTORY_KEY);
  await Notifications.dismissAllNotificationsAsync();
}

export async function unreadNotificationCount() {
  const history = await readNotificationHistory();
  return history.filter((item) => !item.readAt).length;
}

export async function markAllNotificationsRead() {
  const history = await readNotificationHistory();
  const readAt = new Date().toISOString();
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(
    history.map((item) => item.readAt ? item : { ...item, readAt }),
  ));
  await Notifications.setBadgeCountAsync(0).catch(() => false);
}

export async function scheduledFollowUpCount() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((item) => item.content.data?.type === 'follow-up').length;
}
