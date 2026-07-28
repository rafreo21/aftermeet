# Android dev client (live reload)

AfterMeet uses **expo-dev-client**, not Expo Go. The dev build includes speech recognition, NFC, widgets, and other native modules.

## One-time setup

```bash
cd mobile
npm run android:dev-client
```

Plug in your phone with USB debugging on. This builds a **debug APK** and installs it.

## Daily development

Terminal 1 (keep open):

```bash
cd mobile
npm run android:dev
```

This forwards port `8081` over USB and starts Metro.

Open **AfterMeet** on your phone (the dev build — same icon as release). Shake the device → **Reload** after code changes.

## Release builds (no Metro)

```bash
npm run android:install      # release APK, JS embedded
npm run android:rebuild      # clean native rebuild + release
```

## Troubleshooting

- **Stuck on splash** — Metro not running, or USB not forwarded. Run `npm run android:dev` with the phone plugged in.
- **Port 8081 in use** — `run-dev-android.sh` stops the old Metro process automatically.
- **Do not use Expo Go** — it cannot load this project.
