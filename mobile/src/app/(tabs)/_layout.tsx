import { Tabs } from 'expo-router';
import { Gear, House, IdentificationCard } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + Math.max(insets.bottom, 12);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.ink,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        height: tabBarHeight,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
        borderTopColor: colors.line,
        backgroundColor: colors.surface,
      },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <House size={22} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="card" options={{ title: 'My Cards', tabBarIcon: ({ color }) => <IdentificationCard size={23} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="settings" options={{ title: 'My Account', tabBarIcon: ({ color }) => <Gear size={22} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="people" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
    </Tabs>
  );
}
