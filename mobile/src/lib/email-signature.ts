export type SignatureProfile = {
  name: string;
  role: string;
  company: string;
  cardUrl: string;
  showCompany?: boolean;
  photoUrl?: string;
  email?: string;
  phone?: string;
  themeColor?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function subtitleFor(profile: SignatureProfile) {
  return [
    profile.role.trim(),
    profile.showCompany !== false ? profile.company.trim() : '',
  ].filter(Boolean).join(' · ');
}

function contactLines(profile: SignatureProfile) {
  const lines: string[] = [];
  if (profile.email?.trim()) lines.push(profile.email.trim());
  if (profile.phone?.trim()) lines.push(profile.phone.trim());
  return lines;
}

export function buildPlainSignature(profile: SignatureProfile) {
  const lines = [profile.name.trim()];
  const subtitle = subtitleFor(profile);
  if (subtitle) lines.push(subtitle);

  contactLines(profile).forEach((line) => lines.push(line));

  lines.push('');
  lines.push(`View my card: ${profile.cardUrl.trim()}`);
  lines.push('');
  lines.push('—');
  lines.push('Shared with AfterMeet');
  return lines.join('\n');
}

export function buildHtmlSignature(profile: SignatureProfile) {
  const name = escapeHtml(profile.name.trim());
  const subtitle = subtitleFor(profile);
  const accent = escapeHtml(profile.themeColor?.trim() || '#9FE870');
  const cardUrl = escapeHtml(profile.cardUrl.trim());
  const initials = escapeHtml(initialsFor(profile.name));
  const contacts = contactLines(profile);

  const avatarCell = profile.photoUrl?.trim()
    ? `<img src="${escapeHtml(profile.photoUrl.trim())}" alt="${name}" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:999px;object-fit:cover;border:2px solid #E9F7DF;" />`
    : `<div style="width:52px;height:52px;border-radius:999px;background:#163300;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;line-height:52px;text-align:center;">${initials}</div>`;

  const contactHtml = contacts.length
    ? `<tr><td colspan="2" style="padding:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#53634D;">${contacts.map((line) => escapeHtml(line)).join('<br />')}</td></tr>`
    : '';

  return [
    '<!-- AfterMeet email signature -->',
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;max-width:460px;">',
    '<tr>',
    `<td width="5" style="width:5px;background:${accent};border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>`,
    '<td style="padding:0 0 0 16px;">',
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">',
    '<tr>',
    `<td valign="top" style="padding:0 14px 0 0;">${avatarCell}</td>`,
    '<td valign="top">',
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:22px;font-weight:700;color:#163300;">${name}</div>`,
    subtitle
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#53634D;padding-top:2px;">${escapeHtml(subtitle)}</div>`
      : '',
    '<div style="padding-top:12px;">',
    `<a href="${cardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#163300;color:#FFFFFF;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:12px;padding:10px 16px;border-radius:8px;">View my card</a>`,
    '</div>',
    '</td>',
    '</tr>',
    contactHtml,
    '</table>',
    '</td>',
    '</tr>',
    '<tr>',
    '<td colspan="2" style="padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#71806B;">',
    'Shared with <span style="color:#2F5711;font-weight:700;">AfterMeet</span>',
    '</td>',
    '</tr>',
    '</table>',
  ].filter(Boolean).join('');
}
