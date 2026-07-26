import { splitFullName } from "./contacts.ts";
import { sanitizePhoneNumber } from "./contact-fields.ts";

export type EnrichmentField = "email" | "phone";
export type EnrichmentConfidence = "verified" | "likely" | "guess" | "none";
export type EnrichmentStepStatus = "pending" | "running" | "found" | "miss" | "skipped";

export type EnrichmentStep = {
  id: string;
  label: string;
  status: EnrichmentStepStatus;
  value?: string;
  detail?: string;
};

export type EnrichmentInput = {
  fullName: string;
  company: string;
  linkedinUrl?: string;
  field: EnrichmentField;
  seedEmail?: string;
  seedWorkEmail?: string;
  seedPersonalEmail?: string;
  seedPhone?: string;
};

export type EnrichmentResult = {
  field: EnrichmentField;
  value: string;
  confidence: EnrichmentConfidence;
  provider: string;
  steps: EnrichmentStep[];
};

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function guessCompanyDomain(company: string) {
  const withoutParens = company.replace(/\([^)]*\)/g, " ").replace(/\b(?:formerly|previously)\b.+/i, "");
  const stripped = withoutParens
    .replace(/\b(?:inc|llc|ltd|limited|corp|corporation|co|company|group|plc)\.?\b/gi, " ")
    .trim();

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(stripped)) {
    return stripped.toLowerCase();
  }

  const slug = stripped.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 48);
  return slug ? `${slug}.com` : "";
}

export function guessWorkEmail(fullName: string, company: string) {
  const domain = guessCompanyDomain(company);
  if (!domain) return "";

  const { firstName, lastName } = splitFullName(fullName);
  const first = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!first) return "";

  const localParts = [
    last ? `${first}.${last}` : "",
    last ? `${first}${last}` : "",
    last ? `${first[0]}${last}` : "",
    first,
  ].filter(Boolean);

  return `${localParts[0]}@${domain}`;
}

function normalizePhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : digits.replace(/^00/, "+");
}

function linkedInStep(
  field: EnrichmentField,
  seedEmail: string,
  seedWorkEmail: string,
  seedPersonalEmail: string,
  seedPhone: string,
): EnrichmentStep {
  const value = field === "email"
    ? clean(seedWorkEmail).toLowerCase() || clean(seedPersonalEmail).toLowerCase() || clean(seedEmail).toLowerCase()
    : sanitizePhoneNumber(seedPhone);
  return {
    id: "linkedin",
    label: "LinkedIn",
    status: value ? "found" : "miss",
    value: value || undefined,
    detail: value ? "Visible on profile or Contact info" : "Nothing visible for your account",
  };
}

function patternStep(field: EnrichmentField, fullName: string, company: string): EnrichmentStep {
  if (field !== "email") {
    return {
      id: "pattern",
      label: "Work email pattern",
      status: "skipped",
      detail: "Pattern guessing only applies to email",
    };
  }

  const value = guessWorkEmail(fullName, company);
  if (!value) {
    return {
      id: "pattern",
      label: "Work email pattern",
      status: "miss",
      detail: "Need a company name to guess a domain",
    };
  }

  return {
    id: "pattern",
    label: "Work email pattern",
    status: "found",
    value,
    detail: `Likely format for ${guessCompanyDomain(company)}`,
  };
}

async function hunterStep(
  field: EnrichmentField,
  fullName: string,
  company: string,
  apiKey: string | undefined,
): Promise<EnrichmentStep> {
  if (field !== "email") {
    return {
      id: "hunter",
      label: "Hunter.io",
      status: "skipped",
      detail: "Phone lookup providers coming next",
    };
  }

  if (!apiKey) {
    return {
      id: "hunter",
      label: "Hunter.io",
      status: "skipped",
      detail: "Add HUNTER_API_KEY to enable verified work emails",
    };
  }

  const domain = guessCompanyDomain(company);
  const { firstName, lastName } = splitFullName(fullName);
  if (!domain || !firstName) {
    return {
      id: "hunter",
      label: "Hunter.io",
      status: "miss",
      detail: "Need full name and company to search Hunter",
    };
  }

  const url = new URL("https://api.hunter.io/v2/email-finder");
  url.searchParams.set("domain", domain);
  url.searchParams.set("first_name", firstName);
  if (lastName) url.searchParams.set("last_name", lastName);
  url.searchParams.set("api_key", apiKey);

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      return {
        id: "hunter",
        label: "Hunter.io",
        status: "miss",
        detail: `Hunter returned ${response.status}`,
      };
    }

    const payload = await response.json() as {
      data?: { email?: string | null; score?: number | null };
    };
    const email = clean(payload.data?.email ?? "").toLowerCase();
    if (!email) {
      return {
        id: "hunter",
        label: "Hunter.io",
        status: "miss",
        detail: "No verified email in Hunter for this person",
      };
    }

    const score = payload.data?.score ?? 0;
    return {
      id: "hunter",
      label: "Hunter.io",
      status: "found",
      value: email,
      detail: score ? `Confidence score ${score}` : "Verified work email",
    };
  } catch {
    return {
      id: "hunter",
      label: "Hunter.io",
      status: "miss",
      detail: "Could not reach Hunter.io",
    };
  }
}

function placeholderProviders(field: EnrichmentField): EnrichmentStep[] {
  if (field === "email") {
    return [
      { id: "findymail", label: "Findymail", status: "skipped", detail: "Coming soon" },
      { id: "rocketreach", label: "RocketReach", status: "skipped", detail: "Coming soon" },
    ];
  }

  return [
    { id: "prospeo", label: "Prospeo", status: "skipped", detail: "Coming soon" },
    { id: "upcell", label: "Upcell", status: "skipped", detail: "Coming soon" },
    { id: "contactout", label: "ContactOut", status: "skipped", detail: "Coming soon" },
  ];
}

function pickResult(field: EnrichmentField, steps: EnrichmentStep[]): Pick<EnrichmentResult, "value" | "confidence" | "provider"> {
  const priority = field === "email"
    ? ["hunter", "linkedin", "pattern"]
    : ["linkedin"];

  for (const id of priority) {
    const step = steps.find((candidate) => candidate.id === id && candidate.status === "found" && candidate.value);
    if (!step?.value) continue;
    const confidence: EnrichmentConfidence = step.id === "hunter"
      ? "verified"
      : step.id === "linkedin"
        ? "likely"
        : "guess";
    return { value: step.value, confidence, provider: step.id };
  }

  return { value: "", confidence: "none", provider: "" };
}

export async function enrichContactField(
  input: EnrichmentInput,
  options: { hunterApiKey?: string } = {},
): Promise<EnrichmentResult> {
  const fullName = clean(input.fullName);
  const company = clean(input.company);
  const seedEmail = clean(input.seedEmail ?? "");
  const seedPhone = clean(input.seedPhone ?? "");

  const steps: EnrichmentStep[] = [
    linkedInStep(
      input.field,
      input.seedEmail ?? "",
      input.seedWorkEmail ?? "",
      input.seedPersonalEmail ?? "",
      input.seedPhone ?? "",
    ),
    patternStep(input.field, fullName, company),
    await hunterStep(input.field, fullName, company, options.hunterApiKey),
    ...placeholderProviders(input.field),
  ];

  const picked = pickResult(input.field, steps);
  return {
    field: input.field,
    value: picked.value,
    confidence: picked.confidence,
    provider: picked.provider,
    steps,
  };
}

export function enrichmentSourceLabel(provider: string) {
  switch (provider) {
    case "linkedin": return "LinkedIn";
    case "pattern": return "Pattern guess";
    case "hunter": return "Hunter.io";
    default: return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "";
  }
}
