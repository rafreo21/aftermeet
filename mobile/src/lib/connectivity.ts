import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

// Optimistic until the first real event arrives — matches this codebase's
// existing "try the network call, swallow failures" philosophy rather than
// gating UI on a resolved connectivity check at startup.
let cachedOnline = true;
const listeners = new Set<(online: boolean) => void>();
let unsubscribe: (() => void) | null = null;

function resolveOnline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  if (state.isInternetReachable === null) return Boolean(state.isConnected);
  return Boolean(state.isConnected) && state.isInternetReachable;
}

function ensureSubscribed() {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener((state) => {
    const online = resolveOnline(state);
    if (online === cachedOnline) return;
    cachedOnline = online;
    for (const listener of listeners) listener(online);
  });
}

export function isOnline() {
  ensureSubscribed();
  return cachedOnline;
}

export function subscribeConnectivity(listener: (online: boolean) => void) {
  ensureSubscribed();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function onReconnect(listener: () => void) {
  return subscribeConnectivity((online) => {
    if (online) listener();
  });
}

export function useIsOnline() {
  const [online, setOnline] = useState(() => isOnline());
  useEffect(() => subscribeConnectivity(setOnline), []);
  return online;
}
