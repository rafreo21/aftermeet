import { Tabs } from 'expo-router';
import { House, IdentificationCard, UserCircle } from 'phosphor-react-native';

import { AppTabBar } from '@/components/tab-bar';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House size={size} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="card" options={{ title: 'My Cards', tabBarIcon: ({ color, size }) => <IdentificationCard size={size} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="settings" options={{ title: 'My Account', tabBarIcon: ({ color, size }) => <UserCircle size={size} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="people" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
    </Tabs>
  );
}
