import { router } from 'expo-router';
import { ArrowRight, QrCode, Sparkle, UserPlus } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Eyebrow, Panel, Screen, Title } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import { colors, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { card } = useCard();
  return (
    <Screen>
      <View style={styles.header}><Eyebrow>Good evening 👋</Eyebrow><Title>Ready for the next conversation?</Title><Body>Share your card, capture who you met, and keep every promise moving.</Body></View>
      <Panel style={styles.hero}>
        <View style={styles.heroIcon}><QrCode size={30} color={colors.ink} weight="bold" /></View>
        <Text style={styles.heroTitle}>{card.name}</Text><Text style={styles.heroCopy}>Your card is published and ready to share.</Text>
        <Button onPress={() => router.push('/share-card')}>Open sharing mode</Button>
      </Panel>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Today</Text><Text style={styles.count}>3</Text></View>
      {[
        { icon: Sparkle, title: 'Review AI follow-up', copy: 'Sarah · Coffee yesterday' },
        { icon: UserPlus, title: 'Complete James’s details', copy: 'Scanned your card 2h ago' },
      ].map(({ icon: Icon, title, copy }) => <Pressable key={title} style={styles.row}><View style={styles.rowIcon}><Icon size={20} color={colors.ink} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowCopy}>{copy}</Text></View><ArrowRight size={18} color={colors.muted} /></Pressable>)}
      <Panel><Text style={styles.sectionTitle}>Recent people</Text><Body style={{ marginTop: 6 }}>Your relationship timeline will appear here as exchanges and encounters are captured.</Body></Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.x5, gap: spacing.x3 },
  hero: { gap: spacing.x3, backgroundColor: colors.ink },
  heroIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.medium, backgroundColor: colors.accent },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800' },
  heroCopy: { color: '#C5D3BF', marginBottom: spacing.x2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  count: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.round, backgroundColor: colors.accent, color: colors.ink, fontSize: 11, fontWeight: '900' },
  row: { padding: spacing.x4, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderRadius: radius.medium, backgroundColor: colors.surface },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.small, backgroundColor: colors.surfaceMuted },
  rowTitle: { color: colors.ink, fontWeight: '800' },
  rowCopy: { marginTop: 3, color: colors.muted, fontSize: 12 },
});
