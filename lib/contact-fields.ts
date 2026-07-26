import { guessCompanyDomain } from "./contact-enrichment.ts";

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "msn.com",
  "ymail.com",
]);

const COUNTRY_DIAL_CODES: Array<[pattern: RegExp, code: string]> = [
  [/\bunited states\b|\b(u\.?s\.?a?\.?)\b|\bamerica\b/i, "1"],
  [/\bunited kingdom\b|\b(u\.?k\.?)\b|\bengland\b|\bscotland\b|\bwales\b/i, "44"],
  [/\bnigeria\b|\blagos\b|\babuja\b/i, "234"],
  [/\bkenya\b|\bnairobi\b/i, "254"],
  [/\bghana\b|\baccr[a]?a\b/i, "233"],
  [/\bsouth africa\b|\bjohannesburg\b|\bcape town\b/i, "27"],
  [/\bcanada\b|\btoronto\b|\bvancouver\b/i, "1"],
  [/\bindia\b|\bbengaluru\b|\bbangalore\b|\bmumbai\b|\bdelhi\b/i, "91"],
  [/\bgermany\b|\bberlin\b|\bmunich\b/i, "49"],
  [/\bfrance\b|\bparis\b/i, "33"],
  [/\baustralia\b|\bsydney\b|\bmelbourne\b/i, "61"],
  [/\bnetherlands\b|\bamsterdam\b/i, "31"],
  [/\bspain\b|\bmadrid\b|\bbarcelona\b/i, "34"],
  [/\bitaly\b|\bmilan\b|\brome\b/i, "39"],
  [/\bbrazil\b|\bs[aã]o paulo\b/i, "55"],
  [/\buae\b|\bdubai\b|\babu dhabi\b|\bunited arab emirates\b/i, "971"],
  [/\bsingapore\b/i, "65"],
  [/\bireland\b|\bdublin\b/i, "353"],
  [/\bpakistan\b|\bkarachi\b|\blahore\b/i, "92"],
  [/\bphilippines\b|\bmanila\b/i, "63"],
  [/\bmexico\b|\bmx\b/i, "52"],
];

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function emailDomain(email: string) {
  return clean(email).split("@")[1]?.toLowerCase() ?? "";
}

export function isLikelyPersonalEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return false;
  return PERSONAL_EMAIL_DOMAINS.has(domain);
}

export function isLikelyWorkEmail(email: string, company = "") {
  const normalized = clean(email).toLowerCase();
  if (!normalized.includes("@")) return false;

  const domain = emailDomain(normalized);
  const companyDomain = guessCompanyDomain(company);
  if (companyDomain && (domain === companyDomain || domain.endsWith(`.${companyDomain}`))) {
    return true;
  }

  return !isLikelyPersonalEmail(normalized);
}

export function isLikelyNonPhoneText(value: string) {
  const cleaned = clean(value);
  if (!cleaned) return true;
  if (/^\d{4}\s*[–-]\s*(present|\d{4})/i.test(cleaned)) return true;
  if (/^(19|20)\d{2}$/.test(cleaned)) return true;
  if (/^(present|full-time|part-time|internship|contract)$/i.test(cleaned)) return true;
  return false;
}

export function inferDialCodeFromLocation(location: string) {
  const normalized = clean(location);
  if (!normalized) return "";

  for (const [pattern, code] of COUNTRY_DIAL_CODES) {
    if (pattern.test(normalized)) return code;
  }

  return "";
}

export function applyCountryCodeIfNeeded(phone: string, dialCode: string) {
  if (!phone || phone.startsWith("+") || !dialCode) return phone;

  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 7) return phone;

  if (dialCode === "44" && digits.startsWith("0")) {
    return `+44${digits.slice(1)}`;
  }

  if (dialCode === "1" && digits.length === 10) {
    return `+1${digits}`;
  }

  const trimmed = digits.replace(/^0+/, "");
  if (trimmed.length >= 7 && trimmed.length <= 12) {
    return `+${dialCode}${trimmed}`;
  }

  return phone;
}

export function normalizePhoneNumber(value: string) {
  if (isLikelyNonPhoneText(value)) return "";

  const cleaned = clean(value);
  const intlMatch = cleaned.match(/(\+\d[\d\s().-]{5,})/);
  if (intlMatch) {
    const body = intlMatch[1].replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (body.length >= 7 && body.length <= 15) return `+${body}`;
  }

  const compact = cleaned.replace(/\s/g, "");
  if (compact.startsWith("00")) {
    const body = compact.replace(/[^\d]/g, "").replace(/^00/, "");
    if (body.length >= 7 && body.length <= 15) return `+${body}`;
  }

  const digits = cleaned.replace(/[^\d]/g, "");
  if (digits.length >= 7 && digits.length <= 15 && !/^(19|20)\d{2}$/.test(digits)) {
    return digits;
  }

  return "";
}

export function isValidPhoneNumber(value: string) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return false;

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^(19|20)\d{2}$/.test(digits)) return false;
  if (/^(\d)\1{6,}$/.test(digits)) return false;

  return true;
}

export type PhoneSanitizeOptions = {
  locationHint?: string;
};

export function sanitizePhoneNumber(value: string, options: PhoneSanitizeOptions = {}) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return "";

  const dialCode = inferDialCodeFromLocation(options.locationHint ?? "");
  const withCountry = applyCountryCodeIfNeeded(normalized, dialCode);
  return isValidPhoneNumber(withCountry) ? withCountry : "";
}

export function splitCapturedEmails(input: {
  email?: string;
  workEmail?: string;
  personalEmail?: string;
  company?: string;
}) {
  let workEmail = clean(input.workEmail ?? "").toLowerCase();
  let personalEmail = clean(input.personalEmail ?? "").toLowerCase();
  const legacy = clean(input.email ?? "").toLowerCase();
  const company = clean(input.company ?? "");

  const candidates = [legacy, workEmail, personalEmail].filter(Boolean);
  workEmail = "";
  personalEmail = "";

  for (const candidate of candidates) {
    if (isLikelyWorkEmail(candidate, company)) {
      if (!workEmail) workEmail = candidate;
      continue;
    }
    if (!personalEmail) personalEmail = candidate;
  }

  if (legacy && !workEmail && !personalEmail) {
    if (isLikelyPersonalEmail(legacy)) personalEmail = legacy;
    else workEmail = legacy;
  }

  const email = workEmail || personalEmail;
  return { email, workEmail, personalEmail };
}

export function assignCapturedEmail(
  target: { workEmail?: string; personalEmail?: string; email?: string },
  email: string,
  company: string,
  source: "linkedin" | "guess" | "manual" = "linkedin",
) {
  const normalized = clean(email).toLowerCase();
  if (!normalized) return target;

  if (source === "guess" || isLikelyWorkEmail(normalized, company)) {
    if (!target.workEmail) target.workEmail = normalized;
  } else if (!target.personalEmail) {
    target.personalEmail = normalized;
  } else if (!target.workEmail && isLikelyWorkEmail(normalized, company)) {
    target.workEmail = normalized;
  }

  target.email = target.workEmail || target.personalEmail || normalized;
  return target;
}
