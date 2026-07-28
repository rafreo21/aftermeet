#!/usr/bin/env bash
set -euo pipefail

# Build and install the AfterMeet dev client (expo-dev-client + Metro live reload).
# Use this instead of the release APK while developing UI/JS changes.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

REBUILD=0
for arg in "$@"; do
  if [[ "$arg" == "--rebuild" ]]; then
    REBUILD=1
  fi
done

cd "$ROOT"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
MARKER="$ROOT/android/.dev-client-configured"

if [[ "$REBUILD" == "1" || ! -f "$MARKER" ]]; then
  echo "Configuring Android project for expo-dev-client…"
  if [[ "$REBUILD" == "1" ]]; then
    npx expo prebuild --platform android --clean
  else
    npx expo prebuild --platform android
  fi
  echo "dev-client" > "$MARKER"
fi

if [[ "$REBUILD" == "1" || ! -f "$APK" ]]; then
  echo "Building debug dev client APK (connects to Metro on your Mac)…"
  (cd "$ROOT/android" && ./gradlew assembleDebug --no-daemon)
fi

echo "Waiting for Android device…"
adb wait-for-device
boot=""
for _ in $(seq 1 90); do
  boot="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [[ "$boot" == "1" ]] && break
  sleep 2
done

echo "Forwarding Metro port 8081…"
adb reverse tcp:8081 tcp:8081

echo "Installing $APK"
adb install -r -d "$APK"

echo ""
echo "Dev client installed."
echo "  1. In another terminal: cd mobile && npm run android:dev"
echo "  2. Open AfterMeet on your phone (dev build — same icon, debug variant)"
echo "  3. It should connect to Metro; shake device → Reload after code changes"
echo ""
echo "Release APK (no Metro): npm run android:install"
