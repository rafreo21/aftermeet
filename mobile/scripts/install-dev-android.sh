#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

cd "$ROOT"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -f "$APK" ]]; then
  echo "Building AfterMeet dev client (first run may take several minutes)…"
  npx expo run:android --no-install
fi

echo "Waiting for Android device…"
adb wait-for-device
boot=""
for _ in $(seq 1 90); do
  boot="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [[ "$boot" == "1" ]] && break
  sleep 2
done

echo "Installing $APK"
adb install -r -d "$APK"
adb shell am start -n com.aftermeet.app/.MainActivity
echo "Done. Start Metro in another terminal: npm start"
