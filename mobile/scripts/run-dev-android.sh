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
adb reverse tcp:8081 tcp:8081

echo ""
echo "Starting Metro. Keep this terminal open, then open AfterMeet on your phone."
echo "If it was already open, force-quit and reopen, or shake → Reload."
echo ""

npx expo start --clear
