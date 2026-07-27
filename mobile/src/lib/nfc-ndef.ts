export function normalizeCardUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;
}

export function nfcManufacturerPayload(cardUrl: string) {
  const url = normalizeCardUrl(cardUrl);
  return {
    format: 'NDEF',
    recordType: 'URI',
    url,
    encoding: 'utf-8',
    instructions: 'Program NFC Type 2 tags with a single URI record pointing to this card URL.',
  };
}
