import { NativeModules, Platform } from 'react-native';

import { showsCompanyDetails } from '@/features/card/company-display';
import { shareCardDeepLink } from '@/features/card/share-deep-link';
import type { MobileCard } from '@/features/card/types';
import { readEnv } from '@/lib/env';
import { buildWidgetQrFileUri } from '@/lib/widget-qr';

type WidgetBridge = {
  updateWidget?: (payload: {
    name: string;
    role: string;
    company: string;
    cardUrl: string;
    shareDeepLink: string;
    qrImageUri?: string;
  }) => Promise<void>;
};

export async function updateQuickShareWidget(card: MobileCard, cardUrl?: string) {
  const env = readEnv();
  const resolvedUrl = cardUrl || `${env?.publicCardBaseUrl || 'http://localhost:3000'}/c/${card.slug}`;
  const showCompany = showsCompanyDetails(card);
  let qrImageUri: string | undefined;

  try {
    qrImageUri = await buildWidgetQrFileUri(resolvedUrl);
  } catch {
    qrImageUri = undefined;
  }

  const payload = {
    name: card.name.trim() || 'My card',
    role: card.role.trim(),
    company: showCompany ? card.company.trim() : '',
    cardUrl: resolvedUrl,
    shareDeepLink: shareCardDeepLink(card),
    qrImageUri,
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

export function widgetSetupInstructions(platform: 'ios' | 'android') {
  if (platform === 'android') {
    return 'Long-press your home screen → Widgets → AfterMeet Quick Share. Your QR code appears on the widget so people can scan it directly.';
  }
  return 'Long-press your home screen → Edit → search AfterMeet Quick Share. Your QR code appears on the widget so people can scan it directly.';
}
