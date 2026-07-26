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

export function normalizePhoneNumber(value: string) {
  const cleaned = clean(value);
  if (!cleaned) return "";

  const match = cleaned.match(/(\+\d[\d\s().-]{7,}\d|\d[\d\s().-]{9,}\d)/);
  const raw = match ? match[1] : cleaned;
  let digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+") && digits.length >= 10) {
    return digits;
  }
  if (digits.startsWith("+")) return digits;
  return digits;
}

export function isValidPhoneNumber(value: string) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return false;

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 10) return false;
  if (/^(19|20)\d{2}$/.test(digits)) return false;
  if (/^20(1[0-9]|2[0-9]|3[0-5])$/.test(digits) && digits.length === 4) return false;

  return true;
}

export function sanitizePhoneNumber(value: string) {
  const normalized = normalizePhoneNumber(value);
  return isValidPhoneNumber(normalized) ? normalized : "";
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
