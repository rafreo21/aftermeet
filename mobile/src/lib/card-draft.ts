import type { MobileCard } from '@/features/card/types';
import { normalizeThemeColor } from '@/features/card/theme-colors';

function normalizeMethods(methods: MobileCard['methods']) {
  return [...methods]
    .map((method) => ({
      id: method.id,
      type: method.type,
      value: method.value.trim(),
      label: method.label.trim(),
    }))
    .sort((left, right) => {
      const leftKey = `${left.type}:${left.value}:${left.label}:${left.id}`;
      const rightKey = `${right.type}:${right.value}:${right.label}:${right.id}`;
      return leftKey.localeCompare(rightKey);
    });
}

/** Stable snapshot for comparing card editor drafts and published baselines. */
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
    methods: normalizeMethods(card.methods),
  };
  return JSON.stringify(normalized);
}

/** True when the draft differs from what was last published (or is still a draft). */
export function cardNeedsPublish(
  draft: MobileCard,
  publishedBaseline: string | null,
) {
  if (draft.status !== 'published') return true;
  if (!publishedBaseline) return true;
  return cardDraftSignature(draft) !== publishedBaseline;
}
