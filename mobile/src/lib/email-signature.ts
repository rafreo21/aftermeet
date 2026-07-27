export type SignatureProfile = {
  name: string;
  role: string;
  company: string;
  cardUrl: string;
  showCompany?: boolean;
};

export function buildPlainSignature(profile: SignatureProfile) {
  const lines = [profile.name.trim()];
  const subtitle = [
    profile.role.trim(),
    profile.showCompany !== false ? profile.company.trim() : '',
  ].filter(Boolean).join(' · ');
  if (subtitle) lines.push(subtitle);
  lines.push(`View my card: ${profile.cardUrl}`);
  lines.push('');
  lines.push('Shared with AfterMeet');
  return lines.join('\n');
}

export function buildHtmlSignature(profile: SignatureProfile) {
  const subtitle = [
    profile.role.trim(),
    profile.showCompany !== false ? profile.company.trim() : '',
  ].filter(Boolean).join(' · ');

  return [
    `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#163300;">`,
    `<tr><td style="padding:0 0 4px;font-size:15px;font-weight:700;">${escapeHtml(profile.name.trim())}</td></tr>`,
    subtitle ? `<tr><td style="padding:0 0 10px;color:#53634D;">${escapeHtml(subtitle)}</td></tr>` : '',
    `<tr><td style="padding:0 0 10px;"><a href="${escapeHtml(profile.cardUrl)}" style="color:#163300;font-weight:700;text-decoration:none;">View my AfterMeet card</a></td></tr>`,
    `<tr><td style="color:#71806B;font-size:11px;">Shared with AfterMeet</td></tr>`,
    `</table>`,
  ].filter(Boolean).join('');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
