import { cardWithCompanyVisibility, showsCompanyDetails } from '@/features/card/company-display';
import type { ContactMethod, MobileCard } from '@/features/card/types';
import { contactMethodHref } from '@/lib/contact-methods';

const METHOD_LABELS: Record<string, string> = {
  website: 'Website',
  link: 'Link',
  linkedin: 'LinkedIn',
  x: 'X',
  instagram: 'Instagram',
  threads: 'Threads',
  facebook: 'Facebook',
  youtube: 'YouTube',
  snapchat: 'Snapchat',
  tiktok: 'TikTok',
  twitch: 'Twitch',
  yelp: 'Yelp',
  whatsapp: 'WhatsApp',
  signal: 'Signal',
  discord: 'Discord',
  skype: 'Skype',
  telegram: 'Telegram',
  github: 'GitHub',
  calendly: 'Calendly',
  paypal: 'PayPal',
  venmo: 'Venmo',
  cashapp: 'Cash App',
};

function escapeVcard(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeTel(value: string) {
  const normalized = value.trim().replace(/[^\d+]/g, '');
  return normalized.startsWith('+')
    ? `+${normalized.slice(1).replace(/\+/g, '')}`
    : normalized.replace(/\+/g, '');
}

function methodLabel(method: ContactMethod) {
  const custom = method.label?.trim();
  if (custom) return custom;
  return METHOD_LABELS[method.type] || method.type;
}

function appendLabeledUrl(lines: string[], itemIndex: number, label: string, href: string) {
  lines.push(`item${itemIndex}.URL:${escapeVcard(href)}`);
  lines.push(`item${itemIndex}.X-ABLabel:${escapeVcard(label)}`);
}

export type MobileContactQrOptions = {
  /** Drop bio, address, and extra social links so the vCard fits in a QR code. */
  compact?: boolean;
  /** Name, primary contact methods, and AfterMeet card URL only. */
  minimal?: boolean;
};

function shouldIncludeMethod(method: ContactMethod, options: MobileContactQrOptions) {
  if (options.minimal) {
    return method.type === 'email' || method.type === 'phone';
  }
  if (options.compact) {
    return method.type !== 'address';
  }
  return true;
}

function shouldIncludeLabeledUrl(method: ContactMethod, options: MobileContactQrOptions) {
  if (options.minimal) return false;
  if (options.compact) {
    return method.type === 'linkedin' || method.type === 'website' || method.type === 'link';
  }
  return true;
}

/** Offline-capable QR payload with contact details and the card URL. */
export function buildMobileContactQrPayload(
  card: MobileCard,
  cardUrl: string,
  options: MobileContactQrOptions = {},
): string {
  const visible = cardWithCompanyVisibility(card);
  const showCompany = showsCompanyDetails(visible);
  const { firstName, lastName } = splitFullName(visible.name);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'PRODID:-//AfterMeet//Contact Card//EN',
    `N:${escapeVcard(lastName)};${escapeVcard(firstName)};;;`,
    `FN:${escapeVcard(visible.name.trim())}`,
  ];

  if (visible.role.trim()) lines.push(`TITLE:${escapeVcard(visible.role.trim())}`);
  if (showCompany && visible.company.trim()) lines.push(`ORG:${escapeVcard(visible.company.trim())}`);

  const labeledUrls: Array<{ label: string; href: string }> = [];
  let primaryWebsite: string | null = null;
  let itemIndex = 1;

  let emailAdded = false;
  let phoneAdded = false;

  for (const method of visible.methods) {
    const value = method.value.trim();
    if (!value || !shouldIncludeMethod(method, options)) continue;

    if (method.type === 'email') {
      if (options.minimal && emailAdded) continue;
      lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(value)}`);
      emailAdded = true;
      continue;
    }

    if (method.type === 'phone') {
      if (options.minimal && phoneAdded) continue;
      const tel = normalizeTel(value);
      if (tel.length >= 5) {
        lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(tel)}`);
        phoneAdded = true;
      }
      continue;
    }

    if (method.type === 'whatsapp') {
      const tel = normalizeTel(value);
      if (tel.length >= 5) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(tel)}`);
      const href = contactMethodHref(method);
      if (href?.startsWith('http') && shouldIncludeLabeledUrl(method, options)) {
        labeledUrls.push({ label: methodLabel(method), href });
      }
      continue;
    }

    if (method.type === 'address') {
      lines.push(`ADR;TYPE=WORK:;;${escapeVcard(value)};;;;`);
      continue;
    }

    const href = contactMethodHref(method);
    if (!href?.startsWith('http') || !shouldIncludeLabeledUrl(method, options)) continue;

    if ((method.type === 'website' || method.type === 'link') && !primaryWebsite) {
      primaryWebsite = href;
    }

    labeledUrls.push({ label: methodLabel(method), href });
  }

  if (primaryWebsite) {
    lines.push(`URL:${escapeVcard(primaryWebsite)}`);
  }

  if (options.compact) {
    labeledUrls.splice(2);
  }

  for (const entry of labeledUrls) {
    if (primaryWebsite && entry.href === primaryWebsite) continue;
    appendLabeledUrl(lines, itemIndex, entry.label, entry.href);
    itemIndex += 1;
  }

  const cardPage = cardUrl.trim();
  if (cardPage) {
    const cardLinked =
      primaryWebsite === cardPage || labeledUrls.some((entry) => entry.href === cardPage);
    if (!cardLinked) {
      appendLabeledUrl(lines, itemIndex, 'AfterMeet card', cardPage);
    }
  }

  const noteParts: string[] = [];
  if (!options.minimal && !options.compact && visible.bio.trim()) {
    noteParts.push(visible.bio.trim());
  }
  if (!options.minimal && !options.compact && cardPage) {
    noteParts.push(`AfterMeet card: ${cardPage}`);
  }
  if (noteParts.length) {
    lines.push(`NOTE:${escapeVcard(noteParts.join('\n\n'))}`);
  }
  lines.push('END:VCARD');

  return lines.join('\r\n');
}
