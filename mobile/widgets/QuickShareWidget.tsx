import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type QuickShareWidgetProps = {
  name: string;
  role: string;
  company: string;
};

function QuickShareWidget(
  props: QuickShareWidgetProps,
  environment: WidgetEnvironment,
) {
  'widget';

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <HStack modifiers={[padding({ all: 6 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 13 })]}>
          {props.name || 'My card'}
        </Text>
        <Text modifiers={[foregroundStyle('#66785F'), font({ size: 11 })]}>
          Tap to share
        </Text>
      </HStack>
    );
  }

  return (
    <VStack modifiers={[padding({ all: 16 })]}>
      <Text modifiers={[foregroundStyle('#2F5711'), font({ weight: 'bold', size: 11 })]}>
        AFTERMEET
      </Text>
      <Text modifiers={[foregroundStyle('#163300'), font({ weight: 'bold', size: 21 })]}>
        {props.name || 'My card'}
      </Text>
      <Text modifiers={[foregroundStyle('#53634D'), font({ size: 12 })]}>
        {[props.role, props.company].filter(Boolean).join(' · ') || 'Ready to share'}
      </Text>
      <Text modifiers={[foregroundStyle('#163300'), font({ weight: 'semibold', size: 13 })]}>
        Open QR →
      </Text>
    </VStack>
  );
}

export default createWidget('QuickShareWidget', QuickShareWidget);
