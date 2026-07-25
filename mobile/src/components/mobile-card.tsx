import { Image } from 'expo-image';
import { ArrowUpRight, EnvelopeSimple, Globe, Phone, UserCircle } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { openContactMethod } from '@/features/card/contact-actions';
import type { ContactMethod, MobileCard } from '@/features/card/types';
import { colors, radius, spacing } from '@/theme/tokens';

const icons: Partial<Record<ContactMethod['type'], typeof EnvelopeSimple>> = {
  email: EnvelopeSimple,
  phone: Phone,
  website: Globe,
  link: Globe,
};

export function MobileCardPreview({ card, compact = false }: { card: MobileCard; compact?: boolean }) {
  const initials = card.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={styles.card}>
      <View style={[styles.cover, { backgroundColor: card.theme }]}>
        {card.coverPhoto ? <Image alt="" source={card.coverPhoto} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <View style={styles.companyRow}>
          <View style={styles.logo}>{card.companyLogo ? <Image alt={`${card.company} logo`} source={card.companyLogo} style={styles.fill} /> : <Text style={styles.logoText}>{card.company[0] || 'A'}</Text>}</View>
          <Text style={styles.company}>{card.company}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.avatar}>{card.photo ? <Image alt={card.name} source={card.photo} style={styles.fill} /> : <Text style={styles.avatarText}>{initials}</Text>}</View>
        <Text style={styles.name}>{card.name}</Text>
        <Text style={styles.role}>{card.role}{card.company ? ` · ${card.company}` : ''}</Text>
        {!compact && <Text style={styles.bio}>{card.bio}</Text>}
        <View style={styles.methods}>
          {card.methods.slice(0, compact ? 2 : undefined).map((method) => {
            const Icon = icons[method.type] || UserCircle;
            return (
              <Pressable key={method.id} onPress={() => openContactMethod(method)} style={({ pressed }) => [styles.method, pressed && styles.pressed]}>
                <View style={[styles.methodIcon, { backgroundColor: card.theme }]}><Icon size={18} color={colors.ink} weight="bold" /></View>
                <View style={styles.methodCopy}><Text style={styles.methodLabel}>{method.label}</Text><Text numberOfLines={1} style={styles.methodValue}>{method.value}</Text></View>
                <ArrowUpRight size={17} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: radius.large, backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  cover: { height: 138, padding: spacing.x5, justifyContent: 'flex-start' },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  logo: { width: 34, height: 34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: colors.ink },
  logoText: { color: colors.white, fontWeight: '900' },
  company: { color: colors.ink, fontWeight: '800' },
  body: { padding: spacing.x5, paddingTop: 42 },
  avatar: { position: 'absolute', top: -34, left: spacing.x5, width: 68, height: 68, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.surface, borderRadius: radius.round, backgroundColor: colors.ink },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '900' },
  fill: { width: '100%', height: '100%' },
  name: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  role: { marginTop: 3, color: colors.muted, fontSize: 13 },
  bio: { marginTop: spacing.x4, color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  methods: { marginTop: spacing.x5, gap: spacing.x2 },
  method: { minHeight: 56, padding: spacing.x2, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderRadius: radius.medium, backgroundColor: colors.surfaceMuted },
  methodIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round },
  methodCopy: { flex: 1, minWidth: 0 },
  methodLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  methodValue: { marginTop: 2, color: colors.muted, fontSize: 12 },
  pressed: { opacity: 0.7 },
});
