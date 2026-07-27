import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type QrScanWidgetProps = {
  shareDeepLink?: string;
  qrImageUri?: string;
};

function QrScanWidget(props: QrScanWidgetProps) {
  'widget';

  const deepLink = props.shareDeepLink || 'aftermeet://share-card';

  return (
    <VStack modifiers={[padding({ all: 10 }), widgetURL(deepLink)]}>
      {props.qrImageUri ? (
        <Image
          uiImage={props.qrImageUri}
          modifiers={[frame({ width: 120, height: 120 })]}
        />
      ) : (
        <Text modifiers={[foregroundStyle('#9FE870'), font({ weight: 'bold', size: 14 })]}>
          Scan to connect
        </Text>
      )}
    </VStack>
  );
}

export default createWidget('QrScanWidget', QrScanWidget);
