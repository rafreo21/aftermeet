import { Platform } from 'react-native';

import type { MobileCard } from '@/features/card/types';

export async function updateQuickShareWidget(card: MobileCard) {
  if (Platform.OS !== 'ios') return;

  try {
    const { default: widget } = await import('../../../widgets/QuickShareWidget');
    widget.updateSnapshot({
      name: card.name,
      role: card.role,
      company: card.company,
    });
  } catch {
    // Widgets are unavailable in Expo Go and web. The app remains fully usable.
  }
}
