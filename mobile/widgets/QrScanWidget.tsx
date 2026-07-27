import { Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type QrScanWidgetProps = {
  shareDeepLink?: string;
  qrImageUri?: string;
  logoImageUri?: string;
};

function QrScanWidget(props: QrScanWidgetProps) {
  'widget';

  const deepLink = props.shareDeepLink || 'aftermeet://share-card';

  return (
    <VStack modifiers={[padding({ all: 10 }), widgetURL(deepLink)]}>
      {props.qrImageUri ? (
        <ZStack modifiers={[frame({ width: 120, height: 120 })]}>
          <Image
            uiImage={props.qrImageUri}
            modifiers={[frame({ width: 120, height: 120 })]}
          />
          {props.logoImageUri ? (
            <Image
              uiImage={props.logoImageUri}
              modifiers={[frame({ width: 28, height: 28 })]}
            />
          ) : null}
        </ZStack>
      ) : (
        <Text modifiers={[foregroundStyle('#9FE870'), font({ weight: 'bold', size: 14 })]}>
          Scan to connect
        </Text>
      )}
    </VStack>
  );
}

export default createWidget('QrScanWidget', QrScanWidget);
