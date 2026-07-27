import { NativeModules, Platform } from 'react-native';

import type { MobileCard } from '@/features/card/types';
import { showsCompanyDetails } from '@/features/card/company-display';
import { readEnv } from '@/lib/env';

type WidgetBridge = {
  updateWidget?: (payload: {
    name: string;
    role: string;
    company: string;
    cardUrl: string;
  }) => Promise<void>;
};

export async function updateQuickShareWidget(card: MobileCard, cardUrl?: string) {
  const env = readEnv();
  const resolvedUrl = cardUrl || `${env?.publicCardBaseUrl || 'http://localhost:3000'}/c/${card.slug}`;
  const showCompany = showsCompanyDetails(card);
  const payload = {
    name: card.name.trim() || 'My card',
    role: card.role.trim(),
    company: showCompany ? card.company.trim() : '',
    cardUrl: resolvedUrl,
  };

  if (Platform.OS === 'ios') {
    try {
      const { default: widget } = await import('../../../widgets/QuickShareWidget');
      widget.updateSnapshot(payload);
      return;
    } catch {
      throw new Error('The home-screen widget is available after installing a development or production build.');
    }
  }

  if (Platform.OS === 'android') {
    const bridge = NativeModules.QuickShareWidgetBridge as WidgetBridge | undefined;
    if (!bridge?.updateWidget) {
      throw new Error('Rebuild the Android app to enable the home-screen widget.');
    }
    await bridge.updateWidget(payload);
    return;
  }

  throw new Error('Home-screen widgets are only available on iPhone and Android.');
}
