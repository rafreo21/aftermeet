import { Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

// Widget bundles are compiled per-file; a helper imported from a sibling
// module (./widget-shared) resolves at edit time but fails at native widget
// runtime with "Can't find variable". Keep each widget file self-contained.
const WIDGET_COLORS = {
  canvas: '#141814',
  accent: '#9FE870',
  text: '#FFFFFF',
  muted: '#B8C4B3',
  subtle: '#8FA088',
};

type WidgetCardRecord = {
  name: string;
  role: string;
  company: string;
  cardUrl: string;
  shareDeepLink: string;
  initials: string;
  qrImageUri?: string;
  photoImageUri?: string;
};

const DEMO_CARD: WidgetCardRecord = {
  name: 'Alex Morgan',
  role: 'Product Designer',
  company: 'AfterMeet',
  cardUrl: 'https://aftermeet.app/c/demo',
  shareDeepLink: 'aftermeet://share-card',
  initials: 'AM',
};

function parseCardsJson(raw?: string): WidgetCardRecord[] {
  if (!raw?.trim()) return [DEMO_CARD];
  try {
    const parsed = JSON.parse(raw) as WidgetCardRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEMO_CARD];
    return parsed.map((card) => ({
      name: card.name?.trim() || DEMO_CARD.name,
      role: card.role?.trim() || '',
      company: card.company?.trim() || '',
      cardUrl: card.cardUrl?.trim() || DEMO_CARD.cardUrl,
      shareDeepLink: card.shareDeepLink?.trim() || DEMO_CARD.shareDeepLink,
      initials: card.initials?.trim() || DEMO_CARD.initials,
      qrImageUri: card.qrImageUri,
      photoImageUri: card.photoImageUri,
    }));
  } catch {
    return [DEMO_CARD];
  }
}

function activeCard(cards: WidgetCardRecord[], index: number) {
  if (!cards.length) return DEMO_CARD;
  return cards[index % cards.length] ?? cards[0] ?? DEMO_CARD;
}

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
