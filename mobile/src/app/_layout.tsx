import { Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { CardProvider } from '@/features/card/card-context';
import { colors } from '@/theme/tokens';

function applyAndroidNavigationBar() {
  NavigationBar.setStyle('dark');
}

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden after a fast reload.
});

function RootNavigator() {
  const { loading } = useAuth();
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (loading || splashHidden) return;
    void SplashScreen.hideAsync().finally(() => setSplashHidden(true));
  }, [loading, splashHidden]);

  useEffect(() => {
    if (splashHidden) return;
    const timer = setTimeout(() => {
      void SplashScreen.hideAsync().finally(() => setSplashHidden(true));
    }, 8000);
    return () => clearTimeout(timer);
  }, [splashHidden]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="share-card" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="edit-card" />
      <Stack.Screen name="capture" />
      <Stack.Screen name="card-tools" />
      <Stack.Screen name="connections" />
      <Stack.Screen name="connections/[id]" />
      <Stack.Screen name="settings/connected-accounts" />
      <Stack.Screen name="integrations/callback" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.canvas);

    if (Platform.OS !== 'android') {
      return;
    }

    applyAndroidNavigationBar();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        applyAndroidNavigationBar();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CardProvider>
            <StatusBar style="dark" />
            {Platform.OS === 'android' ? <NavigationBar style="dark" /> : null}
            <RootNavigator />
          </CardProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
