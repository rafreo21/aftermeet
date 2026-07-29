import type { MobileCard } from '@/features/card/types';

export function cardLeadDetail(card: MobileCard) {
  const firstMethod = card.methods.find((method) => method.value.trim());
  if (firstMethod?.value.trim()) return firstMethod.value.trim();
  if (card.role.trim()) return card.role.trim();
  if (card.company.trim()) return card.company.trim();
  return 'Add contact details';
}

export function cardDisplayLabel(card: MobileCard) {
  return card.label.trim() || 'Untitled card';
}

export function cardInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AM';
}
