import type { MobileCard } from '@/features/card/types';

export type PublishCardResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

export function formatPublishError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string };
    return [record.message, record.details, record.hint].filter(Boolean).join(' ') || 'Card publishing failed.';
  }
  return 'Card publishing failed.';
}

export function validateCardForPublish(card: MobileCard) {
  if (card.name.trim().length < 2) {
    return 'Add your full name before publishing.';
  }
  if (!card.methods.length) {
    return 'Add at least one contact method before publishing.';
  }
  return null;
}
