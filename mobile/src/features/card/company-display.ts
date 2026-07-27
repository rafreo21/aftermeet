import type { MobileCard } from '@/features/card/types';

export const COMPANY_METHOD_TYPES = new Set(['website']);

export function showsCompanyDetails(card: Pick<MobileCard, 'showCompanyDetails'> & { showCompanyLogo?: boolean }) {
  return card.showCompanyDetails ?? card.showCompanyLogo ?? true;
}

export function cardWithCompanyVisibility(card: MobileCard): MobileCard {
  if (showsCompanyDetails(card)) return card;
  return {
    ...card,
    company: '',
    companyLogo: '',
    methods: card.methods.filter((method) => !COMPANY_METHOD_TYPES.has(method.type)),
  };
}
