import { Tabs } from 'expo-router';
import { Gear, House, IdentificationCard, Tray, Users } from 'phosphor-react-native';

import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.ink,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { height: 82, paddingTop: 8, paddingBottom: 18, borderTopColor: colors.line, backgroundColor: colors.surface },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <House size={22} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="people" options={{ title: 'People', tabBarIcon: ({ color }) => <Users size={22} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="card" options={{ title: 'Card', tabBarIcon: ({ color }) => <IdentificationCard size={23} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: ({ color }) => <Tray size={22} color={String(color)} weight="bold" /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Gear size={22} color={String(color)} weight="bold" /> }} />
    </Tabs>
  );
}
