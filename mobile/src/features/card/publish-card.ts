import type { MobileCard } from '@/features/card/types';

export type PublishCardResult =
  | { ok: true; publicUrl: string }
  | { ok: false; title: string; message: string; detail?: string };

export function formatPublishError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string };
    return [record.message, record.details, record.hint].filter(Boolean).join(' ') || 'Card publishing failed.';
  }
  return 'Card publishing failed.';
}

export function describePublishError(error: string): Omit<Extract<PublishCardResult, { ok: false }>, 'ok'> {
  const lower = error.toLowerCase();

  if (lower.includes('sign in')) {
    return {
      title: 'Sign in required',
      message: 'Sign in to publish your card to the web.',
      detail: error,
    };
  }
  if (lower.includes('full name') || lower.includes('contact method')) {
    return {
      title: 'Card incomplete',
      message: error,
    };
  }
  if (lower.includes('unsupported form data') || lower.includes('formdatapart')) {
    return {
      title: 'Photo upload failed',
      message: 'This device could not send photos using the old upload method.',
      detail: 'Update the app bundle, then try publishing again.',
    };
  }
  if (lower.includes('could not read your') || lower.includes('could not upload your')) {
    return {
      title: 'Photo upload failed',
      message: 'One of your card photos could not be prepared for upload.',
      detail: error,
    };
  }
  if (lower.includes('card not found')) {
    return {
      title: 'Card not saved yet',
      message: 'Your card was not found on the server. Save it first, then publish again.',
      detail: error,
    };
  }
  if (lower.includes('image storage is not configured')) {
    return {
      title: 'Server not ready',
      message: 'Photo storage is not configured on the server yet.',
      detail: error,
    };
  }
  if (lower.includes('session has expired') || lower.includes('jwt')) {
    return {
      title: 'Session expired',
      message: 'Your sign-in session expired. Sign in again, then publish.',
      detail: error,
    };
  }

  return {
    title: 'Publish failed',
    message: error,
  };
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
