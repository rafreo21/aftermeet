import { router } from 'expo-router';
import { PencilSimple, QrCode, Scan } from 'phosphor-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { MobileCardPreview } from '@/components/mobile-card';
import { Body, Button, Eyebrow, Screen, Title } from '@/components/ui';
import { useCard } from '@/features/card/card-context';
import { useAuth } from '@/features/auth/auth-context';
import { colors, spacing } from '@/theme/tokens';

export default function CardScreen() {
  const { card, syncing, publishing, publish, publishError } = useCard();
  const { session } = useAuth();
  return <Screen><View style={styles.header}><Eyebrow>{syncing ? 'Syncing…' : card.status === 'published' ? 'Published' : 'Draft'}</Eyebrow><Title>My card</Title><Body>Your identity, QR code and contact actions in one place.</Body></View>
    <MobileCardPreview card={card} />
    <Button onPress={() => router.push('/share-card')}><QrCode size={18} /> Open QR and share</Button>
    <Button
      loading={publishing}
      variant="secondary"
      onPress={session ? async () => { await publish(); } : () => router.push('/auth')}
    >
      {session ? 'Publish latest changes' : 'Sign in to publish'}
    </Button>
    {publishError ? <Text style={styles.error}>{publishError}</Text> : null}
    <View style={styles.actions}><Button variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/edit-card')}><PencilSimple size={17} /> Edit card</Button><Button variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/scanner')}><Scan size={17} /> Scan QR</Button></View>
  </Screen>;
}
const styles = StyleSheet.create({ header: { paddingTop: spacing.x5, gap: spacing.x3 }, actions: { flexDirection: 'row', gap: spacing.x2 }, error: { color: colors.danger, fontSize: 12, lineHeight: 18 } });
