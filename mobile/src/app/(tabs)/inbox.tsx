import { Check, Clock, Sparkle } from 'phosphor-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Eyebrow, Panel, Screen, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';
export default function InboxScreen() {
  return <Screen><View style={styles.header}><Eyebrow>3 need attention</Eyebrow><Title>Inbox</Title><Body>One focused place for reviews, reminders and relationship promises.</Body></View>
    {[
      { icon: Sparkle, title: 'Approve follow-up draft', meta: 'Sarah Chen · AI review' },
      { icon: Clock, title: 'Follow up today', meta: 'James Okafor · Due 5:00 PM' },
      { icon: Check, title: 'Confirm coffee', meta: 'Maya Singh · Tomorrow' },
    ].map(({ icon: Icon, title, meta }) => <Panel key={title} style={styles.item}><View style={styles.icon}><Icon size={20} color={colors.ink} /></View><View><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{meta}</Text></View></Panel>)}
  </Screen>;
}
const styles = StyleSheet.create({ header: { paddingTop: spacing.x5, gap: spacing.x3 }, item: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 }, icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.small, backgroundColor: colors.accent }, title: { color: colors.ink, fontWeight: '800' }, meta: { marginTop: 4, color: colors.muted, fontSize: 12 } });
