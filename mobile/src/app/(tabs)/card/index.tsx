import { router } from 'expo-router';
import { IdentificationCard, Plus, Scan } from 'phosphor-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';

import { Body, Button, Eyebrow, Panel, Title } from '@/components/ui';
import { MAX_CARDS } from '@/features/card/card-library';
import { useCard } from '@/features/card/card-context';
import { themeForegroundColor } from '@/features/card/theme-colors';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CardLibraryScreen() {
  const { cards, activeCardId, syncing, canCreateCard, createCard, setPrimaryCard } = useCard();
  const insets = useAppInsets();
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.topBar}>
            <View style={styles.headerCopy}>
              <Eyebrow>{syncing ? 'Syncing…' : 'My cards'}</Eyebrow>
              <Title style={styles.title}>Choose a card to open</Title>
              <Body>
                You can create up to {MAX_CARDS} cards. Open one to view details, share it, or make it your primary card.
              </Body>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan QR code"
              onPress={() => router.push('/scanner')}
              style={styles.scanButton}>
              <Scan size={22} color={colors.ink} weight="bold" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.x6 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.grid}>
            {cards.map((item, index) => {
              const isPrimary = item.id === activeCardId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    void setPrimaryCard(item.id!);
                    router.push(`/card/${item.id}`);
                  }}
                  style={({ pressed }) => [styles.cardTile, pressed && styles.pressed]}>
                  <View style={[styles.cover, { backgroundColor: item.theme }]}>
                    <Text style={[styles.coverLetter, { color: themeForegroundColor(item.theme) }]}>{item.company[0] || item.name[0] || 'A'}</Text>
                  </View>
                  <View style={styles.tileBody}>
                    <Text style={styles.cardNumber}>Card {index + 1}</Text>
                    <Text style={styles.cardLabel}>{item.label || `Card ${index + 1}`}</Text>
                    <Text style={styles.cardName}>{item.name || 'Finish setting up this card'}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.cardStatus}>{item.status === 'published' ? 'Published' : 'Draft'}</Text>
                      {isPrimary ? <Text style={styles.primaryBadge}>Primary</Text> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {canCreateCard ? (
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  try {
                    const created = await createCard({ label: `Card ${cards.length + 1}` });
                    if (created) router.push(`/edit-card?id=${created.id}`);
                    else {
                      setErrorMessage('You can save a maximum of five cards.');
                      setErrorSheetOpen(true);
                    }
                  } catch (caught) {
                    setErrorMessage(caught instanceof Error ? caught.message : 'Could not create a card.');
                    setErrorSheetOpen(true);
                  }
                }}
                style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}>
                <View style={styles.addIcon}>
                  <Plus size={24} color={colors.ink} weight="bold" />
                </View>
                <Text style={styles.addTitle}>Create another card</Text>
                <Text style={styles.addCopy}>{MAX_CARDS - cards.length} remaining</Text>
              </Pressable>
            ) : null}
          </View>

          {!cards.length ? (
            <Panel style={styles.empty}>
              <IdentificationCard size={32} color={colors.ink} weight="bold" />
              <Text style={styles.emptyTitle}>Create your first card</Text>
              <Body>Add your identity and the ways people can reach you.</Body>
              <Button
                onPress={async () => {
                  try {
                    const created = await createCard();
                    if (created) router.push(`/edit-card?id=${created.id}`);
                    else {
                      setErrorMessage('Could not create a card right now.');
                      setErrorSheetOpen(true);
                    }
                  } catch (caught) {
                    setErrorMessage(caught instanceof Error ? caught.message : 'Could not create a card.');
                    setErrorSheetOpen(true);
                  }
                }}>
                Create your first card
              </Button>
            </Panel>
          ) : null}
        </ScrollView>
      </View>

      <OutcomeErrorSheet
        visible={errorSheetOpen}
        message={errorMessage}
        onClose={() => {
          setErrorSheetOpen(false);
          setErrorMessage('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1 },
  header: {
    paddingHorizontal: spacing.x5,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
  },
  headerCopy: { flex: 1, gap: spacing.x3 },
  title: { fontSize: 32, lineHeight: 34, letterSpacing: -1.1 },
  scanButton: {
    width: 44,
    height: 44,
    marginTop: spacing.x2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scroll: { flex: 1, marginTop: spacing.x4 },
  scrollContent: {
    paddingHorizontal: spacing.x5,
    gap: spacing.x4,
  },
  grid: { gap: spacing.x4 },
  cardTile: {
    overflow: 'hidden',
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.92 },
  cover: {
    minHeight: 92,
    padding: spacing.x4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverLetter: { fontSize: 28, fontWeight: '900' },
  tileBody: { padding: spacing.x4, gap: 4 },
  cardNumber: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  cardLabel: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  cardName: { color: colors.muted, fontSize: 13 },
  metaRow: { marginTop: spacing.x2, flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  cardStatus: { color: colors.inkSoft, fontSize: 11, fontWeight: '700' },
  primaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.round,
    backgroundColor: colors.accent,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  addTile: {
    padding: spacing.x5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x2,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  addIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
  },
  addTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  addCopy: { color: colors.muted, fontSize: 12 },
  empty: { alignItems: 'flex-start', gap: spacing.x3 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
});
