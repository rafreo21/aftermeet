import { splitFullName } from "./contacts";

export type CapturedProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  companyWebsite: string;
  personalWebsite: string;
  linkedinUrl: string;
  sourceUrl: string;
  source: "linkedin" | "website" | "extension";
};

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value: string) {
  const trimmed = clean(value);
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.split("?")[0]?.replace(/\/+$/, "") ?? trimmed;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

function parseHeadline(headline: string) {
  const atMatch = headline.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return { role: clean(atMatch[1]), company: clean(atMatch[2]) };
  }
  return { role: headline, company: "" };
}

export function captureFromLinkedInDocument(documentLike: {
  title: string;
  location: { href: string };
  querySelector: (selector: string) => { textContent: string | null } | null;
  querySelectorAll: (selector: string) => ArrayLike<{ textContent: string | null; getAttribute?: (name: string) => string | null }>;
}) {
  const linkedinUrl = normalizeUrl(documentLike.location.href.split("?")[0] ?? "");
  const titleName = documentLike.title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const h1 = clean(documentLike.querySelector("h1")?.textContent);
  const fullName = h1 || titleName.split(" - ")[0] || "";
  const { firstName, lastName } = splitFullName(fullName);

  const headline =
    clean(documentLike.querySelector(".text-body-medium")?.textContent)
    || clean(documentLike.querySelector("[data-generated-suggestion-target]")?.textContent)
    || titleName.split(" - ").slice(1).join(" - ");
  const { role, company } = parseHeadline(headline);

  let email = "";
  let phone = "";
  let companyWebsite = "";
  let personalWebsite = "";

  for (const node of documentLike.querySelectorAll("a[href^='mailto:'], a[href^='tel:'], a[href^='http']")) {
    const href = node.getAttribute?.("href") ?? "";
    if (!email && href.startsWith("mailto:")) email = clean(href.replace(/^mailto:/i, "").split("?")[0]);
    if (!phone && href.startsWith("tel:")) phone = clean(href.replace(/^tel:/i, "").split("?")[0]);
    if (href.startsWith("http") && !/linkedin\.com/i.test(href)) {
      const label = clean(node.textContent).toLowerCase();
      const url = normalizeUrl(href);
      if (!personalWebsite && /portfolio|website|blog|site|personal/i.test(label)) personalWebsite = url;
      if (!companyWebsite && /company|employer|organization/i.test(label)) companyWebsite = url;
      if (!personalWebsite && !/linkedin\.com/i.test(url)) personalWebsite = personalWebsite || url;
    }
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    company,
    role,
    companyWebsite,
    personalWebsite,
    linkedinUrl,
    sourceUrl: linkedinUrl,
    source: "linkedin" as const,
  } satisfies CapturedProfile;
}

export function captureFromGenericDocument(documentLike: {
  title: string;
  location: { href: string };
  querySelector: (selector: string) => { textContent: string | null } | null;
}) {
  const sourceUrl = normalizeUrl(documentLike.location.href);
  const title = clean(documentLike.title);
  const h1 = clean(documentLike.querySelector("h1")?.textContent);
  const { firstName, lastName } = splitFullName(h1 || title.split("|")[0] || title);

  return {
    firstName,
    lastName,
    email: "",
    phone: "",
    company: "",
    role: "",
    companyWebsite: /linkedin\.com/i.test(sourceUrl) ? "" : sourceUrl,
    personalWebsite: "",
    linkedinUrl: /linkedin\.com\/in\//i.test(sourceUrl) ? sourceUrl : "",
    sourceUrl,
    source: /linkedin\.com/i.test(sourceUrl) ? "linkedin" as const : "website" as const,
  } satisfies CapturedProfile;
}

export function encodeCapturePayload(profile: Partial<CapturedProfile>) {
  const json = JSON.stringify(profile);
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  return Buffer.from(json, "utf8").toString("base64url");
}
