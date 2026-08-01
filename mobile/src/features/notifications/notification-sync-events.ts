import { DeviceEventEmitter } from 'react-native';

const FOLLOW_UPS_CHANGED_EVENT = 'aftermeet:follow-ups-changed';

export function requestFollowUpNotificationSync() {
  DeviceEventEmitter.emit(FOLLOW_UPS_CHANGED_EVENT);
}

export function addFollowUpNotificationSyncListener(listener: () => void) {
  return DeviceEventEmitter.addListener(FOLLOW_UPS_CHANGED_EVENT, listener);
}
