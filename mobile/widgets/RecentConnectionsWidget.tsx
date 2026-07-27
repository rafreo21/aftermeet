import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type RecentConnectionsWidgetProps = {
  shareDeepLink?: string;
  connection1Name?: string;
  connection1Subtitle?: string;
  connection1Phone?: string;
  connection1Email?: string;
  connection2Name?: string;
  connection2Subtitle?: string;
  connection2Phone?: string;
  connection2Email?: string;
  connection3Name?: string;
  connection3Subtitle?: string;
  connection3Phone?: string;
  connection3Email?: string;
};

function connectionRows(props: RecentConnectionsWidgetProps) {
  return [1, 2, 3].map((index) => {
    const name = props[`connection${index}Name` as keyof RecentConnectionsWidgetProps] as string | undefined;
    const subtitle = props[`connection${index}Subtitle` as keyof RecentConnectionsWidgetProps] as string | undefined;
    if (!name?.trim()) return null;
    return { name: name.trim(), subtitle: subtitle?.trim() || 'Shared via your card' };
  }).filter(Boolean) as Array<{ name: string; subtitle: string }>;
}

function RecentConnectionsWidget(props: RecentConnectionsWidgetProps) {
  'widget';

  const deepLink = props.shareDeepLink || 'aftermeet://share-card';
  const rows = connectionRows(props);

  if (!rows.length) {
    return (
      <VStack modifiers={[padding({ all: 12 }), widgetURL(deepLink)]}>
        <Text modifiers={[foregroundStyle('#FFFFFF'), font({ weight: 'bold', size: 13 })]}>
          Recent connections
        </Text>
        <Text modifiers={[foregroundStyle('#B8C4B3'), font({ size: 11 }), padding({ top: 6 })]}>
          Share your card to see new connections here.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack modifiers={[padding({ all: 10 }), widgetURL(deepLink)]}>
      <Text modifiers={[foregroundStyle('#9FE870'), font({ weight: 'bold', size: 10 })]}>
        RECENT CONNECTIONS
      </Text>
      {rows.map((row) => (
        <HStack key={row.name} modifiers={[padding({ top: 8 })]}>
          <Text modifiers={[foregroundStyle('#FFFFFF'), font({ weight: 'bold', size: 11 }), frame({ width: 22 })]}>
            {row.name.slice(0, 1).toUpperCase()}
          </Text>
          <VStack>
            <Text modifiers={[foregroundStyle('#FFFFFF'), font({ weight: 'bold', size: 12 })]}>
              {row.name}
            </Text>
            <Text modifiers={[foregroundStyle('#8FA088'), font({ size: 10 })]}>
              {row.subtitle}
            </Text>
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
}

export default createWidget('RecentConnectionsWidget', RecentConnectionsWidget);
