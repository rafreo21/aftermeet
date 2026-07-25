import { MagnifyingGlass, Plus, UserCircle } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Eyebrow, Screen, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

const people = [
  { name: 'Sarah Chen', role: 'Partner · North Ventures', status: 'Needs follow-up', when: 'Yesterday' },
  { name: 'James Okafor', role: 'Founder · Fieldwork', status: 'Details incomplete', when: '2h ago' },
  { name: 'Maya Singh', role: 'Product lead · Studio Nine', status: 'Follow-up complete', when: 'Last week' },
];

export default function PeopleScreen() {
  return <Screen><View style={styles.header}><Eyebrow>Relationships</Eyebrow><Title>People</Title><Body>Everything you know, promised and discussed—organized around a person.</Body></View>
    <View style={styles.search}><MagnifyingGlass size={19} color={colors.muted} /><TextInput placeholder="Search people" placeholderTextColor={colors.muted} style={styles.input} /></View>
    {people.map((person) => <Pressable key={person.name} style={styles.person}><View style={styles.avatar}><UserCircle size={26} color={colors.ink} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{person.name}</Text><Text style={styles.role}>{person.role}</Text><Text style={styles.status}>{person.status}</Text></View><Text style={styles.when}>{person.when}</Text></Pressable>)}
    <Pressable style={styles.fab}><Plus size={24} color={colors.ink} weight="bold" /></Pressable>
  </Screen>;
}
const styles = StyleSheet.create({
  header: { paddingTop: spacing.x5, gap: spacing.x3 },
  search: { minHeight: 50, paddingHorizontal: spacing.x4, flexDirection: 'row', alignItems: 'center', gap: spacing.x2, borderRadius: radius.medium, backgroundColor: colors.surface },
  input: { flex: 1, color: colors.ink, fontSize: 15 },
  person: { padding: spacing.x4, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderRadius: radius.medium, backgroundColor: colors.surface },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: colors.surfaceMuted },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  role: { marginTop: 2, color: colors.muted, fontSize: 12 },
  status: { marginTop: 7, color: colors.inkSoft, fontSize: 11, fontWeight: '700' },
  when: { alignSelf: 'flex-start', color: colors.muted, fontSize: 10 },
  fab: { position: 'absolute', right: spacing.x5, bottom: 108, width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: colors.accent, elevation: 5 },
});
