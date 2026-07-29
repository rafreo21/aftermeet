import type { MobileCard } from '@/features/card/types';
import { normalizeThemeColor } from '@/features/card/theme-colors';

/** Stable snapshot for comparing card editor drafts. */
export function cardDraftSignature(card: MobileCard) {
  const normalized = {
    label: card.label.trim(),
    name: card.name.trim(),
    role: card.role.trim(),
    company: card.company.trim(),
    bio: card.bio.trim(),
    theme: normalizeThemeColor(card.theme),
    photo: card.photo.trim(),
    companyLogo: card.companyLogo.trim(),
    coverPhoto: card.coverPhoto.trim(),
    showCompanyDetails: card.showCompanyDetails !== false,
    status: card.status,
    methods: card.methods.map((method) => ({
      type: method.type,
      value: method.value.trim(),
      label: method.label.trim(),
    })),
  };
  return JSON.stringify(normalized);
}
