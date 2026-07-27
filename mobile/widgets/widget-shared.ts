export type WidgetCardRecord = {
  name: string;
  role: string;
  company: string;
  cardUrl: string;
  shareDeepLink: string;
  initials: string;
  qrImageUri?: string;
  photoImageUri?: string;
};

export type WidgetConnectionRecord = {
  name: string;
  subtitle: string;
  phone?: string;
  email?: string;
};

export const WIDGET_COLORS = {
  canvas: '#141814',
  accent: '#9FE870',
  text: '#FFFFFF',
  muted: '#B8C4B3',
  subtle: '#8FA088',
  avatar: '#243024',
  qrPanel: '#000000',
};

export const DEMO_CARD: WidgetCardRecord = {
  name: 'Alex Morgan',
  role: 'Product Designer',
  company: 'AfterMeet',
  cardUrl: 'https://aftermeet.app/c/demo',
  shareDeepLink: 'aftermeet://share-card',
  initials: 'AM',
};

export const DEMO_CONNECTIONS: WidgetConnectionRecord[] = [
  { name: 'Jordan Lee', subtitle: 'Shared via your card' },
  { name: 'Cameron Williamson', subtitle: 'Shared via your card' },
];

export function parseCardsJson(raw?: string): WidgetCardRecord[] {
  if (!raw?.trim()) return [DEMO_CARD];
  try {
    const parsed = JSON.parse(raw) as WidgetCardRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEMO_CARD];
    return parsed.map((card) => ({
      name: card.name?.trim() || DEMO_CARD.name,
      role: card.role?.trim() || '',
      company: card.company?.trim() || '',
      cardUrl: card.cardUrl?.trim() || DEMO_CARD.cardUrl,
      shareDeepLink: card.shareDeepLink?.trim() || DEMO_CARD.shareDeepLink,
      initials: card.initials?.trim() || DEMO_CARD.initials,
      qrImageUri: card.qrImageUri,
      photoImageUri: card.photoImageUri,
    }));
  } catch {
    return [DEMO_CARD];
  }
}

export function activeCardIndex(raw?: string | number) {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function activeCard(cards: WidgetCardRecord[], index: number) {
  if (!cards.length) return DEMO_CARD;
  return cards[index % cards.length] ?? cards[0] ?? DEMO_CARD;
}

export function connectionSlots(props: Record<string, string | number | undefined>) {
  const rows = [1, 2, 3].map((slot) => {
    const name = String(props[`connection${slot}Name`] || '').trim();
    if (!name) return null;
    return {
      name,
      subtitle: String(props[`connection${slot}Subtitle`] || 'Shared via your card').trim(),
      phone: String(props[`connection${slot}Phone`] || '').trim(),
      email: String(props[`connection${slot}Email`] || '').trim(),
    };
  }).filter(Boolean) as WidgetConnectionRecord[];

  return rows.length ? rows : DEMO_CONNECTIONS;
}

export function cardPagerLabel(index: number, total: number) {
  return `CARD ${String((index % total) + 1).padStart(2, '0')}`;
}

export function dialUrl(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

export function messageUrl(email: string, phone: string) {
  if (phone.trim()) return `sms:${phone.replace(/\s+/g, '')}`;
  if (email.trim()) return `mailto:${email.trim()}`;
  return '';
}
