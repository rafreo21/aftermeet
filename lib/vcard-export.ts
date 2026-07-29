import { buildWhenWeMetNote } from "./card-share-links.ts";
import { contactMethodHref } from "./contact-methods.ts";
import { splitFullName } from "./contacts.ts";

export type CardVcardMethod = {
  method_type: string;
  value: string;
  label?: string | null;
};

export type CardVcardInput = {
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  cardUrl: string;
  methods: CardVcardMethod[];
  showCompanyDetails?: boolean;
  scannedAt?: Date;
};

const METHOD_LABELS: Record<string, string> = {
  website: "Website",
  link: "Link",
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
  youtube: "YouTube",
  snapchat: "Snapchat",
  tiktok: "TikTok",
  twitch: "Twitch",
  yelp: "Yelp",
  whatsapp: "WhatsApp",
  signal: "Signal",
  discord: "Discord",
  skype: "Skype",
  telegram: "Telegram",
  github: "GitHub",
  calendly: "Calendly",
  paypal: "PayPal",
  venmo: "Venmo",
  cashapp: "Cash App",
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

function methodLabel(method: CardVcardMethod) {
  const custom = method.label?.trim();
  if (custom) return custom;
  return METHOD_LABELS[method.method_type] || method.method_type;
}

function appendLabeledUrl(lines: string[], itemIndex: number, label: string, href: string) {
  lines.push(`item${itemIndex}.URL:${escapeVcard(href)}`);
  lines.push(`item${itemIndex}.X-ABLabel:${escapeVcard(label)}`);
}

export function buildCardVcard(input: CardVcardInput) {
  const whenWeMetNote = buildWhenWeMetNote(input.cardUrl, input.scannedAt);
  const showCompany = input.showCompanyDetails ?? true;
  const methods = showCompany
    ? input.methods
    : input.methods.filter((method) => method.method_type !== "website");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//AfterMeet//Contact Card//EN",
    `N:${buildStructuredName(input.fullName)}`,
    `FN:${escapeVcard(input.fullName.trim())}`,
  ];

  if (input.jobTitle?.trim()) lines.push(`TITLE:${escapeVcard(input.jobTitle.trim())}`);
  if (showCompany && input.company?.trim()) lines.push(`ORG:${escapeVcard(input.company.trim())}`);

  const labeledUrls: Array<{ label: string; href: string }> = [];
  let primaryWebsite: string | null = null;
  let itemIndex = 1;

  for (const method of methods) {
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
      const href = contactMethodHref({ type: method.method_type, value });
      if (href?.startsWith("http")) {
        labeledUrls.push({ label: methodLabel(method), href });
      }
      continue;
    }

    if (method.method_type === "address") {
      lines.push(`ADR;TYPE=WORK:;;${escapeVcard(value)};;;;`);
      continue;
    }

    const href = contactMethodHref({ type: method.method_type, value });
    if (!href?.startsWith("http")) continue;

    if ((method.method_type === "website" || method.method_type === "link") && !primaryWebsite) {
      primaryWebsite = href;
    }

    labeledUrls.push({ label: methodLabel(method), href });
  }

  if (primaryWebsite) {
    lines.push(`URL:${escapeVcard(primaryWebsite)}`);
  }

  for (const entry of labeledUrls) {
    if (primaryWebsite && entry.href === primaryWebsite) continue;
    appendLabeledUrl(lines, itemIndex, entry.label, entry.href);
    itemIndex += 1;
  }

  const cardPage = input.cardUrl.trim();
  if (cardPage) {
    const cardLinked =
      primaryWebsite === cardPage || labeledUrls.some((entry) => entry.href === cardPage);
    if (!cardLinked) {
      appendLabeledUrl(lines, itemIndex, "AfterMeet card", cardPage);
    }
  }

  const noteParts = [input.bio?.trim(), whenWeMetNote].filter(Boolean);
  lines.push(`NOTE:${escapeVcard(noteParts.join("\n\n"))}`);
  lines.push("END:VCARD");

  return {
    body: `${lines.join("\r\n")}\r\n`,
    filename: vcardFilename(input.fullName),
  };
}
