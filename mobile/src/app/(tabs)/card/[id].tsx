import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { PencilSimple, ShareNetwork, Star, Trash, Wrench } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardDeleteSheet } from '@/components/card-delete-sheet';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { MobileCardPreview } from '@/components/mobile-card';
import { BackButton, Body, Button, Eyebrow } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import { useAppInsets, useTabBarHeight } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CardDetailScreen() {
  const navigation = useNavigation();
  const tabBarHeight = useTabBarHeight();
  const insets = useAppInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getCardById,
    card,
    isPrimaryCard,
    setPrimaryCard,
    cardPublicUrl,
    deleteCard,
  } = useCard();

  const selected = (id ? getCardById(id) : undefined) || card;
  const primary = isPrimaryCard(selected.id || '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      const tabNav = navigation.getParent();
      tabNav?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => {
        tabNav?.setOptions({
          tabBarStyle: {
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: Math.max(12, tabBarHeight - 56),
            borderTopColor: colors.line,
            backgroundColor: colors.surface,
          },
        });
      };
    }, [navigation, tabBarHeight]),
  );

  async function confirmDelete() {
    if (!selected.id) return;
    setDeleting(true);
    try {
      await deleteCard(selected.id);
      setDeleteOpen(false);
      router.back();
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Could not delete this card.');
      setErrorSheetOpen(true);
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit card"
                onPress={() => router.push(`/edit-card?id=${selected.id}`)}
                style={styles.headerIconButton}>
                <PencilSimple size={20} color={colors.ink} weight="bold" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete card"
                onPress={() => setDeleteOpen(true)}
                style={[styles.headerIconButton, styles.headerIconButtonDanger]}>
                <Trash size={20} color={colors.danger} weight="bold" />
              </Pressable>
            </View>
          </View>
          <View style={styles.headerCopy}>
            <Eyebrow>Viewing</Eyebrow>
            <Text style={styles.detailTitle}>{selected.label || selected.name || 'Untitled card'}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.x6 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.badges}>
            <Text style={styles.status}>{selected.status === 'published' ? 'Published' : 'Draft'}</Text>
            {primary ? (
              <View style={styles.primaryBadge}>
                <Star size={12} color={colors.ink} weight="fill" />
                <Text style={styles.primaryText}>Primary card</Text>
              </View>
            ) : (
              <Button variant="ghost" onPress={() => void setPrimaryCard(selected.id!)}>
                Make primary
              </Button>
            )}
          </View>

          <MobileCardPreview card={selected} />
          <Body style={styles.url}>{cardPublicUrl(selected)}</Body>

          <Button onPress={() => router.push(`/share-card?id=${selected.id}`)}>
            <ShareNetwork size={18} color={colors.ink} weight="bold" />
            Share this card
          </Button>
          <Button variant="secondary" onPress={() => router.push(`/card-tools?id=${selected.id}`)}>
            <Wrench size={18} color={colors.ink} weight="bold" />
            Card tools
          </Button>
        </ScrollView>
      </View>

      <CardDeleteSheet
        visible={deleteOpen}
        title={selected.label || selected.name || 'Untitled card'}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />

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
    gap: spacing.x3,
    paddingHorizontal: spacing.x5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },
  headerIconButtonDanger: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  headerCopy: { gap: spacing.x2 },
  detailTitle: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  scroll: { flex: 1, marginTop: spacing.x4 },
  scrollContent: {
    paddingHorizontal: spacing.x5,
    gap: spacing.x4,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  status: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: colors.accent,
  },
  primaryText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  url: { fontSize: 12, textAlign: 'center' },
});
