#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

REBUILD=0
for arg in "$@"; do
  if [[ "$arg" == "--rebuild" ]]; then
    REBUILD=1
  fi
done

cd "$ROOT"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

if [[ "$REBUILD" == "1" || ! -f "$APK" ]]; then
  echo "Building AfterMeet dev client (native + JS bundle baked in for first launch)…"
  echo "This can take several minutes on a clean rebuild."
  npx expo prebuild --platform android --clean
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
adb reverse tcp:8081 tcp:8081
adb shell am start -n com.aftermeet.app/.MainActivity
echo ""
echo "Done."
echo "  Build label in app: Capture home footer (v1.0.1 build 2)."
echo "  For live JS updates while developing, run in another terminal:"
echo "    npm run android:dev"
echo "  Force a fresh native rebuild anytime:"
echo "    npm run android:rebuild"
