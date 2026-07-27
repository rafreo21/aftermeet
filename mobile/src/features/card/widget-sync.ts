import { NativeModules, Platform } from 'react-native';

import type { MobileCard } from '@/features/card/types';

type WidgetBridge = {
  updateWidget?: (payload: { name: string; role: string; company: string }) => Promise<void>;
};

export async function updateQuickShareWidget(card: MobileCard) {
  if (Platform.OS === 'ios') {
    try {
      const { default: widget } = await import('../../../widgets/QuickShareWidget');
      widget.updateSnapshot({
        name: card.name,
        role: card.role,
        company: card.company,
      });
    } catch {
      // Widgets are unavailable in Expo Go. The app remains fully usable.
    }
    return;
  }

  if (Platform.OS === 'android') {
    try {
      const bridge = NativeModules.QuickShareWidgetBridge as WidgetBridge | undefined;
      await bridge?.updateWidget?.({
        name: card.name,
        role: card.role,
        company: card.company,
      });
    } catch {
      // Native widget bridge is only available in dev/production builds.
    }
  }
}
