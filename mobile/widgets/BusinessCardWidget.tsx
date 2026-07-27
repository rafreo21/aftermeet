import { HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type BusinessCardWidgetProps = {
  name: string;
  role: string;
  company: string;
  initials?: string;
  shareDeepLink?: string;
  qrImageUri?: string;
  logoImageUri?: string;
  photoImageUri?: string;
};

function BusinessCardWidget(props: BusinessCardWidgetProps) {
  'widget';

  const deepLink = props.shareDeepLink || 'aftermeet://share-card';

  return (
    <HStack modifiers={[padding({ all: 10 }), widgetURL(deepLink)]}>
      <VStack modifiers={[frame({ width: 92, height: 92 }), padding({ all: 6 })]}>
        {props.qrImageUri ? (
          <ZStack modifiers={[frame({ width: 80, height: 80 })]}>
            <Image uiImage={props.qrImageUri} modifiers={[frame({ width: 80, height: 80 })]} />
            {props.logoImageUri ? (
              <Image uiImage={props.logoImageUri} modifiers={[frame({ width: 20, height: 20 })]} />
            ) : null}
          </ZStack>
        ) : (
          <Text modifiers={[foregroundStyle('#FFFFFF'), font({ weight: 'bold', size: 12 })]}>QR</Text>
        )}
      </VStack>
      <VStack modifiers={[padding({ leading: 10 })]}>
        {props.photoImageUri ? (
          <Image uiImage={props.photoImageUri} modifiers={[frame({ width: 30, height: 30 })]} />
        ) : (
          <Text modifiers={[foregroundStyle('#FFFFFF'), font({ weight: 'bold', size: 11 })]}>
            {props.initials || 'AM'}
          </Text>
        )}
        <Text modifiers={[foregroundStyle('#FFFFFF'), font({ weight: 'bold', size: 15 }), padding({ top: 6 })]}>
          {props.name || 'My card'}
        </Text>
        {props.role ? (
          <Text modifiers={[foregroundStyle('#B8C4B3'), font({ size: 11 }), padding({ top: 2 })]}>
            {props.role}
          </Text>
        ) : null}
        {props.company ? (
          <Text modifiers={[foregroundStyle('#8FA088'), font({ size: 10 }), padding({ top: 2 })]}>
            {props.company}
          </Text>
        ) : null}
        <Text modifiers={[foregroundStyle('#9FE870'), font({ size: 9, weight: 'bold' }), padding({ top: 8 })]}>
          AFTERMEET
        </Text>
      </VStack>
    </HStack>
  );
}

export default createWidget('BusinessCardWidget', BusinessCardWidget);
