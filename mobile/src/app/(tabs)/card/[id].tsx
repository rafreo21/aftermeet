import { router, useLocalSearchParams } from 'expo-router';
import { DeviceMobile, PencilSimple, QrCode, Scan, Star } from 'phosphor-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { MobileCardPreview } from '@/components/mobile-card';
import { Body, Button, PageHeader, Screen } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getCardById,
    card,
    isPrimaryCard,
    setPrimaryCard,
    cardPublicUrl,
  } = useCard();

  const selected = (id ? getCardById(id) : undefined) || card;
  const primary = isPrimaryCard(selected.id || '');

  return (
    <Screen>
      <PageHeader
        eyebrow="Viewing"
        title={selected.label || selected.name || 'Untitled card'}
        titleStyle={styles.detailTitle}
      />

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

      <Button onPress={() => router.push('/share-card')}>
        <QrCode size={18} /> Share this card
      </Button>
      <Button variant="secondary" onPress={() => router.push('/card-tools')}>
        <DeviceMobile size={17} /> Wallet, NFC, signature, widget
      </Button>

      <View style={styles.actions}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/edit-card?id=${selected.id}`)}>
          <PencilSimple size={17} /> Edit card
        </Button>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/scanner')}>
          <Scan size={17} /> Scan QR
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  detailTitle: { fontSize: 28, lineHeight: 30 },
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
  actions: { flexDirection: 'row', gap: spacing.x2 },
});
