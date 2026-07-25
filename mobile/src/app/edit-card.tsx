import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Check, Image as ImageIcon, X } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Eyebrow, Screen, Title } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import type { MobileCard } from '@/features/card/types';
import { colors, radius, spacing } from '@/theme/tokens';

const themes = ['#9FE870', '#FF6B5E', '#FF9F43', '#FFC107', '#14B8A6', '#2495E8', '#5146E5', '#A83DF0', '#163300'];

export default function EditCardScreen() {
  const { card, updateCard } = useCard();
  const [draft, setDraft] = useState(card);

  function field(key: keyof MobileCard, value: string) { setDraft((current) => ({ ...current, [key]: value })); }
  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (!result.canceled) field('photo', result.assets[0].uri);
  }
  async function save() { await updateCard(draft); router.back(); }

  return <Screen><View style={styles.top}><View><Eyebrow>Card editor</Eyebrow><Title>Edit identity</Title></View><Pressable onPress={() => router.back()} style={styles.close}><X size={20} color={colors.ink} /></Pressable></View>
    <Pressable onPress={choosePhoto} style={styles.photo}><ImageIcon size={24} color={colors.ink} /><Text style={styles.photoText}>{draft.photo ? 'Change profile picture' : 'Add profile picture'}</Text></Pressable>
    {([
      ['name', 'Full name'], ['role', 'Job title'], ['company', 'Company'], ['bio', 'Short introduction'],
    ] as [keyof MobileCard, string][]).map(([key, label]) => <View key={key} style={styles.field}><Text style={styles.label}>{label}</Text><TextInput multiline={key === 'bio'} value={String(draft[key])} onChangeText={(value) => field(key, value)} style={[styles.input, key === 'bio' && styles.textarea]} /></View>)}
    <View><Text style={styles.label}>Card colour</Text><View style={styles.swatches}>{themes.map((theme) => <Pressable accessibilityLabel={`Use ${theme}`} key={theme} onPress={() => field('theme', theme)} style={[styles.swatch, { backgroundColor: theme }]}>{draft.theme === theme && <Check size={18} color={theme === '#163300' ? colors.white : colors.ink} weight="bold" />}</Pressable>)}</View></View>
    <Button onPress={save}>Save changes</Button><Body>Contact methods can be edited from the web card creator while the native method editor is completed.</Body>
  </Screen>;
}
const styles = StyleSheet.create({
  top: { paddingTop: spacing.x5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: colors.surface },
  photo: { minHeight: 88, padding: spacing.x4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.x3, borderRadius: radius.medium, backgroundColor: colors.surfaceMuted },
  photoText: { color: colors.ink, fontWeight: '800' },
  field: { gap: spacing.x2 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 50, paddingHorizontal: spacing.x4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, backgroundColor: colors.surface, color: colors.ink, fontSize: 15 },
  textarea: { minHeight: 110, paddingTop: spacing.x4, textAlignVertical: 'top' },
  swatches: { marginTop: spacing.x3, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x3 },
  swatch: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.small },
});
