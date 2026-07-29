import { Platform } from 'react-native';

import type { ContactMethod } from '@/features/card/types';
import { openUrlCandidates } from '@/lib/open-url-candidates';

const handle = (value: string) => value.trim().replace(/^@/, '').replace(/^\/+|\/+$/g, '');
const webOr = (value: string, fallback: string) => /^https?:\/\//i.test(value) ? value : fallback;
const phone = (value: string) => value.replace(/[^\d+]/g, '');

/** Preferred open order: native app scheme first, then universal/web fallback. */
export function contactActionCandidates(method: ContactMethod): string[] {
  const value = method.value.trim();
  const user = handle(value);
  if (!value) return [];

  switch (method.type) {
    case 'email':
      return [`mailto:${value}`];
    case 'phone': {
      const normalized = phone(value);
      return normalized ? [`tel:${normalized}`] : [];
    }
    case 'website':
    case 'link':
    case 'calendly':
      return [webOr(value, `https://${value}`)];
    case 'address': {
      const encoded = encodeURIComponent(value);
      if (Platform.OS === 'ios') {
        return [`maps:0,0?q=${encoded}`, `http://maps.apple.com/?q=${encoded}`];
      }
      if (Platform.OS === 'android') {
        return [`geo:0,0?q=${encoded}`, `https://www.google.com/maps/search/?api=1&query=${encoded}`];
      }
      return [`https://www.google.com/maps/search/?api=1&query=${encoded}`];
    }
    case 'x': {
      const web = webOr(value, `https://x.com/${user}`);
      return user ? [`twitter://user?screen_name=${user}`, web] : [web];
    }
    case 'instagram': {
      const web = webOr(value, `https://instagram.com/${user}`);
      return user ? [`instagram://user?username=${user}`, web] : [web];
    }
    case 'threads': {
      const web = webOr(value, `https://threads.net/@${user}`);
      return user ? [`barcelona://user?username=${user}`, web] : [web];
    }
    case 'linkedin': {
      const web = webOr(value, `https://linkedin.com/in/${user}`);
      return user ? [`linkedin://in/${user}`, web] : [web];
    }
    case 'facebook': {
      const web = webOr(value, `https://facebook.com/${user}`);
      return user ? [`fb://profile/${user}`, web] : [web];
    }
    case 'youtube':
      return [webOr(value, `https://youtube.com/@${user}`)];
    case 'snapchat': {
      const web = webOr(value, `https://snapchat.com/add/${user}`);
      return user ? [`snapchat://add/${user}`, web] : [web];
    }
    case 'tiktok': {
      const web = webOr(value, `https://tiktok.com/@${user}`);
      return user ? [`snssdk1233://user/profile/${user}`, web] : [web];
    }
    case 'twitch':
      return [webOr(value, `https://twitch.tv/${user}`)];
    case 'yelp':
      return [webOr(value, `https://www.yelp.com/search?find_desc=${encodeURIComponent(value)}`)];
    case 'whatsapp': {
      const digits = phone(value).replace(/^\+/, '');
      const web = webOr(value, `https://wa.me/${digits}`);
      return digits ? [`whatsapp://send?phone=${digits}`, web] : [web];
    }
    case 'signal': {
      const web = webOr(value, `https://signal.me/#p/${encodeURIComponent(phone(value))}`);
      return [web];
    }
    case 'discord':
      return /^https?:\/\//i.test(value) ? [value] : [];
    case 'skype':
      return [`skype:${encodeURIComponent(user)}?chat`];
    case 'telegram': {
      const web = webOr(value, `https://t.me/${user}`);
      return user ? [`tg://resolve?domain=${user}`, web] : [web];
    }
    case 'github':
      return [webOr(value, `https://github.com/${user}`)];
    case 'paypal': {
      const web = webOr(value, `https://paypal.me/${user}`);
      return user ? [`paypal://paypal.me/${user}`, web] : [web];
    }
    case 'venmo': {
      const web = webOr(value, `https://account.venmo.com/u/${user}`);
      return user ? [`venmo://paycharge?txn=pay&recipients=${user}`, web] : [web];
    }
    case 'cashapp': {
      const tag = user.replace(/^\$/, '');
      const web = webOr(value, `https://cash.app/$${tag}`);
      return tag ? [`cashapp://cash.app/$${tag}`, web] : [web];
    }
    default:
      return [];
  }
}

export function contactActionUrl(method: ContactMethod): string | null {
  return contactActionCandidates(method)[0] ?? null;
}

export async function openContactMethod(method: ContactMethod) {
  return openUrlCandidates(contactActionCandidates(method));
}

/** Opens follow-up links with the same native-app-first behavior. */
export async function openExternalHref(href: string, candidates?: string[]) {
  const trimmed = href.trim();
  if (!trimmed && !candidates?.length) return false;
  const ordered = candidates?.length ? candidates : hrefActionCandidates(trimmed);
  return openUrlCandidates(ordered.length ? ordered : [trimmed]);
}

function hrefActionCandidates(href: string): string[] {
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return [href];

  if (/linkedin\.com\/in\//i.test(href)) {
    const handle = href.split(/linkedin\.com\/in\//i)[1]?.split(/[/?#]/)[0];
    if (handle) return [`linkedin://in/${handle}`, href];
  }

  if (/wa\.me\//i.test(href)) {
    const digits = href.split(/wa\.me\//i)[1]?.split(/[/?#]/)[0]?.replace(/\D/g, '');
    if (digits) return [`whatsapp://send?phone=${digits}`, href];
  }

  if (/instagram\.com\//i.test(href)) {
    const handle = href.split(/instagram\.com\//i)[1]?.split(/[/?#]/)[0];
    if (handle) return [`instagram://user?username=${handle}`, href];
  }

  if (/x\.com\//i.test(href) || /twitter\.com\//i.test(href)) {
    const handle = href.split(/(?:x|twitter)\.com\//i)[1]?.split(/[/?#]/)[0];
    if (handle) return [`twitter://user?screen_name=${handle}`, href];
  }

  if (/tiktok\.com\/@/i.test(href)) {
    const handle = href.split(/tiktok\.com\/@/i)[1]?.split(/[/?#]/)[0];
    if (handle) return [`snssdk1233://user/profile/${handle}`, href];
  }

  if (/paypal\.me\//i.test(href)) {
    const user = href.split(/paypal\.me\//i)[1]?.split(/[/?#]/)[0];
    if (user) return [`paypal://paypal.me/${user}`, href];
  }

  return [href];
}
