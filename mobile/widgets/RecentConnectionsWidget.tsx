import { HStack, Link, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import {
  connectionSlots,
  dialUrl,
  messageUrl,
  WIDGET_COLORS,
} from './widget-shared';

export type RecentConnectionsWidgetProps = {
  connectionsDeepLink?: string;
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

function RecentConnectionsWidget(props: RecentConnectionsWidgetProps) {
  'widget';

  const deepLink = props.connectionsDeepLink || props.shareDeepLink || 'aftermeet://connections';
  const rows = connectionSlots(props);

  return (
    <VStack
      modifiers={[
        containerBackground(WIDGET_COLORS.canvas, 'widget'),
        padding({ all: 10 }),
        widgetURL(deepLink),
      ]}>
      <Text modifiers={[foregroundStyle(WIDGET_COLORS.accent), font({ weight: 'bold', size: 10 })]}>
        RECENT CONNECTIONS
      </Text>
      {rows.map((row) => {
        const phoneUrl = dialUrl(row.phone || '');
        const messageHref = messageUrl(row.email || '', row.phone || '');

        return (
          <HStack key={row.name} modifiers={[padding({ top: 8 })]}>
            <Text
              modifiers={[
                foregroundStyle(WIDGET_COLORS.accent),
                font({ weight: 'bold', size: 11 }),
                frame({ width: 24, height: 24 }),
                cornerRadius(12),
              ]}>
              {row.name.slice(0, 1).toUpperCase()}
            </Text>
            <VStack modifiers={[padding({ leading: 4 })]}>
              <Text modifiers={[foregroundStyle(WIDGET_COLORS.text), font({ weight: 'bold', size: 12 })]}>
                {row.name}
              </Text>
              <Text modifiers={[foregroundStyle(WIDGET_COLORS.subtle), font({ size: 10 })]}>
                {row.subtitle}
              </Text>
            </VStack>
            {phoneUrl ? (
              <Link destination={phoneUrl}>
                <Text
                  modifiers={[
                    foregroundStyle(WIDGET_COLORS.text),
                    font({ size: 12 }),
                    frame({ width: 28, height: 28 }),
                    cornerRadius(14),
                  ]}>
                  ☎
                </Text>
              </Link>
            ) : null}
            {messageHref ? (
              <Link destination={messageHref}>
                <Text
                  modifiers={[
                    foregroundStyle(WIDGET_COLORS.text),
                    font({ size: 12 }),
                    frame({ width: 28, height: 28 }),
                    cornerRadius(14),
                  ]}>
                  ✉
                </Text>
              </Link>
            ) : null}
          </HStack>
        );
      })}
    </VStack>
  );
}

export default createWidget('RecentConnectionsWidget', RecentConnectionsWidget);
