import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type QuickShareWidgetProps = {
  name: string;
  role: string;
  company: string;
  shareDeepLink?: string;
  qrImageUri?: string;
};

function QuickShareWidget(
  props: QuickShareWidgetProps,
  environment: WidgetEnvironment,
) {
  'widget';

  const deepLink = props.shareDeepLink || 'aftermeet://share-card';

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <HStack modifiers={[padding({ all: 6 }), widgetURL(deepLink)]}>
        {props.qrImageUri ? (
          <Image uiImage={props.qrImageUri} modifiers={[frame({ width: 36, height: 36 })]} />
        ) : null}
        <Text modifiers={[font({ weight: 'bold', size: 13 })]}>
          {props.name || 'My card'}
        </Text>
      </HStack>
    );
  }

  return (
    <VStack modifiers={[padding({ all: 14 }), widgetURL(deepLink)]}>
      <Text modifiers={[foregroundStyle('#2F5711'), font({ weight: 'bold', size: 10 })]}>
        AFTERMEET
      </Text>
      {props.qrImageUri ? (
        <Image uiImage={props.qrImageUri} modifiers={[frame({ width: 132, height: 132 }), padding({ top: 8 })]} />
      ) : (
        <Text modifiers={[foregroundStyle('#163300'), font({ weight: 'bold', size: 18 }), padding({ top: 8 })]}>
          {props.name || 'My card'}
        </Text>
      )}
      <Text modifiers={[foregroundStyle('#53634D'), font({ size: 11 }), padding({ top: 6 })]}>
        {[props.role, props.company].filter(Boolean).join(' · ') || 'Scan to connect'}
      </Text>
    </VStack>
  );
}

export default createWidget('QuickShareWidget', QuickShareWidget);
