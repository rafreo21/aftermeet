import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/auth-context';
import { CardProvider } from '@/features/card/card-context';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CardProvider>
            <StatusBar style="dark" />
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
            </Stack>
          </CardProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
