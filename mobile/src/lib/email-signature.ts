export type SignatureProfile = {
  name: string;
  role: string;
  company: string;
  cardUrl: string;
};

export function buildPlainSignature(profile: SignatureProfile) {
  const lines = [profile.name];
  const subtitle = [profile.role, profile.company].filter(Boolean).join(' · ');
  if (subtitle) lines.push(subtitle);
  lines.push(`View my card: ${profile.cardUrl}`);
  return lines.join('\n');
}

export function buildHtmlSignature(profile: SignatureProfile) {
  const subtitle = [profile.role, profile.company].filter(Boolean).join(' · ');
  return [
    `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#163300;">`,
    `<tr><td style="padding:0 0 4px;font-weight:700;">${escapeHtml(profile.name)}</td></tr>`,
    subtitle ? `<tr><td style="padding:0 0 8px;color:#454745;">${escapeHtml(subtitle)}</td></tr>` : '',
    `<tr><td><a href="${escapeHtml(profile.cardUrl)}" style="color:#163300;font-weight:700;">View my AfterMeet card</a></td></tr>`,
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
