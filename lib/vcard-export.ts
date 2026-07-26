import { buildWhenWeMetNote } from "./card-share-links.ts";
import { contactMethodHref } from "./contact-methods.ts";
import { splitFullName } from "./contacts.ts";

export type CardVcardMethod = {
  method_type: string;
  value: string;
};

export type CardVcardInput = {
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  cardUrl: string;
  methods: CardVcardMethod[];
  scannedAt?: Date;
};

export function escapeVcard(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function normalizeTel(value: string) {
  const normalized = value.trim().replace(/[^\d+]/g, "");
  return normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized.replace(/\+/g, "");
}

function buildStructuredName(fullName: string) {
  const { firstName, lastName } = splitFullName(fullName);
  return `${escapeVcard(lastName)};${escapeVcard(firstName)};;;`;
}

function vcardFilename(fullName: string) {
  return fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "aftermeet-contact";
}

export function buildCardVcard(input: CardVcardInput) {
  const whenWeMetNote = buildWhenWeMetNote(input.cardUrl, input.scannedAt);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//AfterMeet//Contact Card//EN",
    `N:${buildStructuredName(input.fullName)}`,
    `FN:${escapeVcard(input.fullName.trim())}`,
  ];

  if (input.jobTitle?.trim()) lines.push(`TITLE:${escapeVcard(input.jobTitle.trim())}`);
  if (input.company?.trim()) lines.push(`ORG:${escapeVcard(input.company.trim())}`);

  let primaryUrl: string | null = null;
  const socialLines: string[] = [];

  for (const method of input.methods) {
    const value = method.value.trim();
    if (!value) continue;

    if (method.method_type === "email") {
      lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(value)}`);
      continue;
    }

    if (method.method_type === "phone") {
      const tel = normalizeTel(value);
      if (tel.length >= 5) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(tel)}`);
      continue;
    }

    if (method.method_type === "whatsapp") {
      const tel = normalizeTel(value);
      if (tel.length >= 5) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(tel)}`);
      continue;
    }

    if (method.method_type === "address") {
      lines.push(`ADR;TYPE=WORK:;;${escapeVcard(value)};;;;`);
      continue;
    }

    const href = contactMethodHref({ type: method.method_type, value });
    if (!href?.startsWith("http")) continue;

    if (method.method_type === "linkedin") {
      socialLines.push(`X-SOCIALPROFILE;type=linkedin:${escapeVcard(href)}`);
      continue;
    }

    if ((method.method_type === "website" || method.method_type === "link") && !primaryUrl) {
      primaryUrl = href;
      continue;
    }

    socialLines.push(`X-SOCIALPROFILE;type=${escapeVcard(method.method_type)}:${escapeVcard(href)}`);
  }

  if (!primaryUrl) {
    for (const method of input.methods) {
      const href = contactMethodHref({ type: method.method_type, value: method.value.trim() });
      if (href?.startsWith("http") && method.method_type !== "linkedin") {
        primaryUrl = href;
        break;
      }
    }
  }

  if (primaryUrl) lines.push(`URL:${escapeVcard(primaryUrl)}`);
  lines.push(...socialLines);

  const noteParts = [input.bio?.trim(), whenWeMetNote].filter(Boolean);
  lines.push(`NOTE:${escapeVcard(noteParts.join("\n\n"))}`);
  lines.push("END:VCARD");

  return {
    body: `${lines.join("\r\n")}\r\n`,
    filename: vcardFilename(input.fullName),
  };
}
