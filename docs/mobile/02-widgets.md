# iOS and Android widgets

## Product behaviour

The first widget is **AfterMeet Quick Share**. Its purpose is narrow: get from
the home or lock screen to the full-screen contact QR in one tap.

The widget is an entry point, not a miniature copy of the app. Editing, scanning,
authentication, and relationship work stay in the app.

## iOS

`expo-widgets` creates a WidgetKit extension with small, medium, and lock-screen
rectangular families. The snapshot is refreshed whenever the locally cached card
changes.

Files:

- `mobile/widgets/QuickShareWidget.tsx`
- `mobile/src/features/card/widget-sync.ts`
- widget configuration in `mobile/app.json`

The app and extension use the application group
`group.com.aftermeet.app`. Apple Developer provisioning must enable that exact
group for both targets.

## Android

The custom Expo config plugin generates an Android `AppWidgetProvider`, layout,
drawables, metadata, and manifest receiver during prebuild. Tapping either the
surface or its action opens `aftermeet://share-card`.

File:

- `mobile/plugins/withAndroidQuickShareWidget.js`

Run `npx expo prebuild --clean` after changing native widget metadata. Do not use
`--clean` when the generated native folders contain hand-written changes that
have not been moved into a config plugin.

## Testing

1. Build and install the native development app.
2. Launch it once and edit the card.
3. iOS: long-press the Home Screen, add AfterMeet, and test every supported
   family.
4. Android: open the widget picker, add AfterMeet Quick Share, resize it, and
   tap both the card and button.
5. Confirm the deep link opens Quick Share and the QR resolves on a second
   device.

Widgets cannot be fully validated in a browser or Expo Go; they require a signed
native build and a simulator or physical device.
