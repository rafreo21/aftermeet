import * as Linking from 'expo-linking';

import type { ContactMethod } from '@/features/card/types';

const handle = (value: string) => value.trim().replace(/^@/, '').replace(/^\/+|\/+$/g, '');
const webOr = (value: string, fallback: string) => /^https?:\/\//i.test(value) ? value : fallback;
const phone = (value: string) => value.replace(/[^\d+]/g, '');

export function contactActionUrl(method: ContactMethod): string | null {
  const value = method.value.trim();
  const user = handle(value);
  if (!value) return null;
  switch (method.type) {
    case 'email': return `mailto:${value}`;
    case 'phone': return `tel:${phone(value)}`;
    case 'website':
    case 'link':
    case 'calendly': return webOr(value, `https://${value}`);
    case 'address': return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
    case 'x': return webOr(value, `https://x.com/${user}`);
    case 'instagram': return webOr(value, `https://instagram.com/${user}`);
    case 'threads': return webOr(value, `https://threads.net/@${user}`);
    case 'linkedin': return webOr(value, `https://linkedin.com/in/${user}`);
    case 'facebook': return webOr(value, `https://facebook.com/${user}`);
    case 'youtube': return webOr(value, `https://youtube.com/@${user}`);
    case 'snapchat': return webOr(value, `https://snapchat.com/add/${user}`);
    case 'tiktok': return webOr(value, `https://tiktok.com/@${user}`);
    case 'twitch': return webOr(value, `https://twitch.tv/${user}`);
    case 'yelp': return webOr(value, `https://www.yelp.com/search?find_desc=${encodeURIComponent(value)}`);
    case 'whatsapp': return webOr(value, `https://wa.me/${phone(value).replace(/^\+/, '')}`);
    case 'signal': return webOr(value, `https://signal.me/#p/${encodeURIComponent(phone(value))}`);
    case 'discord': return /^https?:\/\//i.test(value) ? value : null;
    case 'skype': return `skype:${encodeURIComponent(user)}?chat`;
    case 'telegram': return webOr(value, `https://t.me/${user}`);
    case 'github': return webOr(value, `https://github.com/${user}`);
    case 'paypal': return webOr(value, `https://paypal.me/${user}`);
    case 'venmo': return webOr(value, `https://account.venmo.com/u/${user}`);
    case 'cashapp': return webOr(value, `https://cash.app/$${user.replace(/^\$/, '')}`);
    default: return null;
  }
}

export async function openContactMethod(method: ContactMethod) {
  const url = contactActionUrl(method);
  if (!url || !(await Linking.canOpenURL(url))) return false;
  await Linking.openURL(url);
  return true;
}
