import { contactActionUrl } from '@/features/card/contact-actions';
import type { ContactMethod } from '@/features/card/types';

export type ContactMethodLike = {
  type: string;
  value: string;
};

export function contactMethodHref(method: ContactMethodLike): string | null {
  return contactActionUrl(method as ContactMethod);
}
