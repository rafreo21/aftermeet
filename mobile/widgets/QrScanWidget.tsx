import { Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import {
  activeCard,
  parseCardsJson,
  WIDGET_COLORS,
} from './widget-shared';

export type QrScanWidgetProps = {
  shareDeepLink?: string;
  qrImageUri?: string;
  logoImageUri?: string;
  cardsJson?: string;
};

function QrScanWidget(props: QrScanWidgetProps) {
  'widget';

  const cards = parseCardsJson(props.cardsJson);
  const card = activeCard(cards, 0);
  const deepLink = card.shareDeepLink || props.shareDeepLink || 'aftermeet://share-card';
  const qrImageUri = card.qrImageUri || props.qrImageUri;

  return (
    <VStack
      modifiers={[
        containerBackground(WIDGET_COLORS.canvas, 'widget'),
        padding({ all: 8 }),
        widgetURL(deepLink),
      ]}>
      <VStack modifiers={[padding({ all: 4 })]}>
        {qrImageUri ? (
          <ZStack modifiers={[frame({ width: 120, height: 120 })]}>
            <Image uiImage={qrImageUri} modifiers={[frame({ width: 120, height: 120 })]} />
            {props.logoImageUri ? (
              <Image uiImage={props.logoImageUri} modifiers={[frame({ width: 24, height: 24 })]} />
            ) : null}
          </ZStack>
        ) : (
          <Text modifiers={[foregroundStyle(WIDGET_COLORS.accent), font({ weight: 'bold', size: 13 })]}>
            Scan to connect
          </Text>
        )}
      </VStack>
    </VStack>
  );
}

export default createWidget('QrScanWidget', QrScanWidget);
