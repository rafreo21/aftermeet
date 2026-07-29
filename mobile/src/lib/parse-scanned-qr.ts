function unescapeVcard(value: string) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function cleanUrl(value: string) {
  return unescapeVcard(value).split(/\s/)[0]?.trim() ?? '';
}

export function parseAfterMeetCardSlugFromUrl(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/c\/([^/?#]+)/i);
    return match?.[1]?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function extractSlugFromVcard(vcard: string) {
  const lines = vcard.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const labeledUrl = line.match(/^item\d+\.URL:(.+)$/i);
    if (labeledUrl) {
      const label = lines[index + 1] || '';
      if (/AfterMeet card/i.test(label)) {
        const slug = parseAfterMeetCardSlugFromUrl(cleanUrl(labeledUrl[1]));
        if (slug) return slug;
      }
    }

    const urlLine = line.match(/^(?:URL|item\d+\.URL):(.+)$/i);
    if (urlLine) {
      const slug = parseAfterMeetCardSlugFromUrl(cleanUrl(urlLine[1]));
      if (slug) return slug;
    }

    if (/^NOTE:/i.test(line)) {
      const note = unescapeVcard(line.replace(/^NOTE:/i, ''));
      const matches = note.match(/https?:\/\/[^\s]+/g) ?? [];
      for (const url of matches) {
        const slug = parseAfterMeetCardSlugFromUrl(url);
        if (slug) return slug;
      }
    }
  }

  return null;
}

/** Resolve an AfterMeet card slug from a scanned QR payload (URL or embedded vCard). */
export function parseAfterMeetCardSlugFromScan(raw: string) {
  const value = raw.replace(/^\uFEFF/, '').trim();
  if (!value) return null;

  const slugFromUrl = parseAfterMeetCardSlugFromUrl(value);
  if (slugFromUrl) return slugFromUrl;

  if (/^BEGIN:VCARD/i.test(value)) {
    return extractSlugFromVcard(value);
  }

  return null;
}
