import { cardWithCompanyVisibility, showsCompanyDetails } from '@/features/card/company-display';
import type { MobileCard } from '@/features/card/types';
import { publicCardImageUrl } from '@/lib/card-assets-client';
import { appendVcardImages, type VcardImageFields } from '@/lib/vcard-images';
import { appendMobileVcardMethods } from '@/lib/vcard-methods';

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

export type MobileContactQrOptions = {
  /** Drop bio, address, and extra social links so the vCard fits in a QR code. */
  compact?: boolean;
  /** Name, primary contact methods, and AfterMeet card URL only. */
  minimal?: boolean;
};

function vcardImageFields(card: MobileCard, options: MobileContactQrOptions): VcardImageFields {
  const showCompany = showsCompanyDetails(card);
  const profilePhotoUrl = publicCardImageUrl(card.photo);
  const companyLogoUrl = showCompany ? publicCardImageUrl(card.companyLogo) : null;
  const coverPhotoUrl = publicCardImageUrl(card.coverPhoto);

  if (options.minimal) {
    return profilePhotoUrl ? { profilePhotoUrl } : {};
  }
  if (options.compact) {
    return {
      ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
      ...(companyLogoUrl ? { companyLogoUrl, showCompanyDetails: true } : {}),
    };
  }
  return {
    profilePhotoUrl,
    companyLogoUrl,
    coverPhotoUrl,
    showCompanyDetails: showCompany,
  };
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

  appendVcardImages(lines, vcardImageFields(visible, options));

  if (visible.role.trim()) lines.push(`TITLE:${escapeVcard(visible.role.trim())}`);
  if (showCompany && visible.company.trim()) lines.push(`ORG:${escapeVcard(visible.company.trim())}`);

  const { itemIndex, noteExtras } = appendMobileVcardMethods(lines, visible.methods, {
    showCompanyDetails: showCompany,
    compact: options.compact,
    minimal: options.minimal,
  });

  let nextItemIndex = itemIndex;
  const cardPage = cardUrl.trim();
  if (cardPage) {
    const cardAlreadyLinked = lines.some((line) => line.includes(cardPage));
    if (!cardAlreadyLinked) {
      lines.push(`item${nextItemIndex}.URL:${escapeVcard(cardPage)}`);
      lines.push(`item${nextItemIndex}.X-ABLabel:${escapeVcard('AfterMeet card')}`);
      nextItemIndex += 1;
    }
  }

  const coverUrl = vcardImageFields(visible, options).coverPhotoUrl;
  if (!options.minimal && !options.compact && coverUrl?.trim()) {
    lines.push(`item${nextItemIndex}.URL:${escapeVcard(coverUrl.trim())}`);
    lines.push(`item${nextItemIndex}.X-ABLabel:${escapeVcard('Cover photo')}`);
  }

  const noteParts: string[] = [];
  if (!options.minimal && !options.compact && visible.bio.trim()) {
    noteParts.push(visible.bio.trim());
  }
  if (noteExtras.length) {
    noteParts.push(...noteExtras);
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
