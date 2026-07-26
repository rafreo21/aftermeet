function clean(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function splitName(fullName) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function normalizeUrl(value) {
  const trimmed = clean(value);
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.split("?")[0].replace(/\/+$/, "");
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

function parseHeadline(headline) {
  const match = headline.match(/^(.+?)\s+at\s+(.+)$/i);
  if (match) return { role: clean(match[1]), company: clean(match[2]) };
  return { role: headline, company: "" };
}

function captureLinkedInProfile() {
  const linkedinUrl = normalizeUrl(window.location.href.split("?")[0]);
  const titleName = document.title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const h1 = clean(document.querySelector("h1")?.textContent);
  const fullName = h1 || titleName.split(" - ")[0] || "";
  const { firstName, lastName } = splitName(fullName);
  const headline =
    clean(document.querySelector(".text-body-medium")?.textContent)
    || clean(document.querySelector("[data-generated-suggestion-target]")?.textContent)
    || titleName.split(" - ").slice(1).join(" - ");
  const { role, company } = parseHeadline(headline);

  let email = "";
  let phone = "";
  let companyWebsite = "";
  let personalWebsite = "";

  document.querySelectorAll("a[href^='mailto:'], a[href^='tel:'], a[href^='http']").forEach((node) => {
    const href = node.getAttribute("href") || "";
    if (!email && href.startsWith("mailto:")) email = clean(href.replace(/^mailto:/i, "").split("?")[0]);
    if (!phone && href.startsWith("tel:")) phone = clean(href.replace(/^tel:/i, "").split("?")[0]);
    if (href.startsWith("http") && !/linkedin\.com/i.test(href)) {
      const label = clean(node.textContent).toLowerCase();
      const url = normalizeUrl(href);
      if (!personalWebsite && /portfolio|website|blog|site|personal/i.test(label)) personalWebsite = url;
      if (!companyWebsite && /company|employer|organization/i.test(label)) companyWebsite = url;
    }
  });

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
    source: "extension",
  };
}

function captureGenericProfile() {
  const sourceUrl = normalizeUrl(window.location.href.split("?")[0]);
  const title = clean(document.title);
  const h1 = clean(document.querySelector("h1")?.textContent);
  const { firstName, lastName } = splitName(h1 || title.split("|")[0] || title);
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
    source: /linkedin\.com/i.test(sourceUrl) ? "linkedin" : "website",
  };
}

function captureCurrentPage() {
  if (/linkedin\.com\/in\//i.test(window.location.href)) return captureLinkedInProfile();
  return captureGenericProfile();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "aftermeet-capture") return;
  sendResponse({ profile: captureCurrentPage(), pageText: document.body?.innerText?.slice(0, 6000) ?? "" });
});
