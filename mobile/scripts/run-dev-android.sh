#!/usr/bin/env bash
set -euo pipefail

# Run AfterMeet dev client on a USB-connected Android phone.
# Fixes "stuck on splash screen" by forwarding Metro (8081) to the phone.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

cd "$ROOT"

if ! adb devices | grep -v '^List' | grep -q 'device$'; then
  echo ""
  echo "No Android device found."
  echo "1. Plug in your phone with USB"
  echo "2. On phone: Settings → Developer options → USB debugging ON"
  echo "3. Tap Allow on the 'USB debugging' prompt"
  echo "4. Run this script again"
  echo ""
  exit 1
fi

echo "Forwarding phone port 8081 → Mac Metro (8081)…"
if adb devices | grep -v '^List' | grep -q 'device$'; then
  adb reverse tcp:8081 tcp:8081
else
  echo "Warning: no USB device — plug in your phone or use the same Wi‑Fi + manual URL in the dev menu."
fi

# Avoid stale Metro blocking startup in non-interactive shells.
if lsof -ti:8081 >/dev/null 2>&1; then
  echo "Stopping existing Metro on port 8081…"
  lsof -ti:8081 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo ""
echo "Starting Metro for dev client. Keep this terminal open."
echo "Open the AfterMeet dev build on your phone (not Expo Go)."
echo "Install dev client once: npm run android:dev-client"
echo "If it was already open, force-quit and reopen, or shake → Reload."
echo ""

npx expo start --dev-client --clear --port 8081
