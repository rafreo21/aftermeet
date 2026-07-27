export type WidgetConnection = {
  name: string;
  subtitle: string;
  phone?: string;
  email?: string;
};

export type WidgetSnapshot = {
  name: string;
  role: string;
  company: string;
  cardUrl: string;
  shareDeepLink: string;
  qrImageUri?: string;
  initials: string;
  connections: WidgetConnection[];
};

export const WIDGET_OPTIONS = [
  {
    id: 'qr-scan',
    title: 'QR Scan',
    size: '2 × 2',
    description: 'Large scannable QR code for quick sharing.',
  },
  {
    id: 'business-card',
    title: 'Business Card',
    size: '4 × 2',
    description: 'QR code plus your name, role, and company.',
  },
  {
    id: 'recent-connections',
    title: 'Recent Connections',
    size: '4 × 2',
    description: 'People who recently shared their details with you.',
  },
] as const;

export type WidgetOptionId = (typeof WIDGET_OPTIONS)[number]['id'];
