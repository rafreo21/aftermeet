import type { MobileCard } from '@/features/card/types';

export const PREVIEW_CARD_ID = 'preview-primary-card';

export function isPreviewCard(card: Pick<MobileCard, 'id'>) {
  return card.id === PREVIEW_CARD_ID;
}

export const defaultCard: MobileCard = {
  id: PREVIEW_CARD_ID,
  slug: 'alex-morgan',
  label: 'My primary card',
  name: 'Alex Morgan',
  role: 'Independent Consultant',
  company: 'Northstar Advisory',
  bio: 'I help growing teams turn messy ideas into clear products people want.',
  theme: '#9FE870',
  photo: '',
  companyLogo: '',
  coverPhoto: '',
  showCompanyDetails: true,
  status: 'published',
  methods: [
    { id: 'email', type: 'email', value: 'alex@example.com', label: 'Work email' },
    { id: 'website', type: 'website', value: 'https://northstar.example', label: 'Visit my website' },
    { id: 'linkedin', type: 'linkedin', value: 'alex-morgan', label: 'Connect on LinkedIn' },
  ],
};
