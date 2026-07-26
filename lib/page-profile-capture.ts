import { splitFullName } from "./contacts.ts";

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

export function parseHeadline(headline: string) {
  const cleaned = clean(headline);
  if (!cleaned) return { role: "", company: "" };

  const atMatch = cleaned.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return { role: clean(atMatch[1]), company: clean(atMatch[2]) };
  }

  const dotParts = cleaned.split(/\s*[·|@]\s*/).map(clean).filter(Boolean);
  if (dotParts.length >= 2) {
    return { role: dotParts[0], company: dotParts.slice(1).join(" · ") };
  }

  return { role: cleaned, company: "" };
}

function readMetaContent(
  documentLike: { querySelector: (selector: string) => { getAttribute?: (name: string) => string | null } | null },
  key: string,
) {
  const node = documentLike.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
  return clean(node?.getAttribute?.("content"));
}

function headlineFromTitle(title: string) {
  const titleName = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const dashParts = titleName.split(/\s+[-–—]\s+/);
  if (dashParts.length > 1) return dashParts.slice(1).join(" - ");
  return "";
}

function headlineFromOpenGraph(documentLike: {
  querySelector: (selector: string) => { getAttribute?: (name: string) => string | null } | null;
}) {
  const ogTitle = readMetaContent(documentLike, "og:title").replace(/\s*\|\s*LinkedIn\s*$/i, "");
  if (ogTitle) {
    const dashParts = ogTitle.split(/\s+[-–—]\s+/);
    if (dashParts.length > 1) return dashParts.slice(1).join(" - ");
  }
  return readMetaContent(documentLike, "og:description");
}

function headlineFromDom(documentLike: {
  querySelector: (selector: string) => { textContent: string | null } | null;
}) {
  const selectors = [
    ".text-body-medium",
    "[data-generated-suggestion-target]",
    "div[data-view-name=\"profile-card\"] h2",
    ".pv-text-details__left-panel h2",
    ".top-card-layout__headline",
  ];
  for (const selector of selectors) {
    const value = clean(documentLike.querySelector(selector)?.textContent);
    if (value && value.length <= 160) return value;
  }
  return "";
}

function headlineFromPageText(documentLike: { body?: { innerText?: string | null } }, fullName: string) {
  const lines = (documentLike.body?.innerText ?? "").split("\n").map(clean).filter(Boolean);
  const nameIndex = lines.findIndex((line) => line === fullName || line.startsWith(fullName));
  if (nameIndex < 0) return "";
  for (let index = nameIndex + 1; index < Math.min(nameIndex + 4, lines.length); index += 1) {
    const candidate = lines[index];
    if (candidate.length > 160) continue;
    if (/^(message|connect|follow|more|contact info|www\.)/i.test(candidate)) continue;
    if (/^\d/.test(candidate)) continue;
    return candidate;
  }
  return "";
}

function extractLinks(documentLike: {
  querySelectorAll: (selector: string) => ArrayLike<{ textContent: string | null; getAttribute?: (name: string) => string | null }>;
}) {
  let email = "";
  let phone = "";
  let companyWebsite = "";
  let personalWebsite = "";

  for (const node of documentLike.querySelectorAll("a[href^='mailto:'], a[href^='tel:'], a[href^='http']")) {
    const href = node.getAttribute?.("href") ?? "";
    if (!email && href.startsWith("mailto:")) email = clean(href.replace(/^mailto:/i, "").split("?")[0]);
    if (!phone && href.startsWith("tel:")) phone = clean(href.replace(/^tel:/i, "").split("?")[0]);
    if (!href.startsWith("http") || /linkedin\.com/i.test(href)) continue;
    const label = clean(node.textContent).toLowerCase();
    const url = normalizeUrl(href);
    if (!personalWebsite && /portfolio|website|blog|site|personal/i.test(label)) personalWebsite = url;
    if (!companyWebsite && /company|employer|organization/i.test(label)) companyWebsite = url;
  }

  return { email, phone, companyWebsite, personalWebsite };
}

export function captureFromLinkedInDocument(documentLike: {
  title: string;
  location: { href: string };
  body?: { innerText?: string | null };
  querySelector: (selector: string) => { textContent: string | null; getAttribute?: (name: string) => string | null } | null;
  querySelectorAll: (selector: string) => ArrayLike<{ textContent: string | null; getAttribute?: (name: string) => string | null }>;
}) {
  const linkedinUrl = normalizeUrl(documentLike.location.href.split("?")[0] ?? "");
  const titleName = documentLike.title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const h1 = clean(documentLike.querySelector("h1")?.textContent);
  const ogTitle = readMetaContent(documentLike, "og:title").replace(/\s*\|\s*LinkedIn\s*$/i, "");
  const fullName = h1 || ogTitle.split(/\s+[-–—]\s+/)[0] || titleName.split(" - ")[0] || "";
  const { firstName, lastName } = splitFullName(fullName);

  const headline =
    headlineFromDom(documentLike)
    || headlineFromOpenGraph(documentLike)
    || headlineFromPageText(documentLike, fullName)
    || headlineFromTitle(documentLike.title);
  const { role, company } = parseHeadline(headline);
  const links = extractLinks(documentLike);

  return {
    firstName,
    lastName,
    email: links.email,
    phone: links.phone,
    company,
    role,
    companyWebsite: links.companyWebsite,
    personalWebsite: links.personalWebsite,
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
