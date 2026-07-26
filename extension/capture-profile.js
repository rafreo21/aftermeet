(function initAfterMeetCapture() {
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
    const cleaned = clean(headline);
    if (!cleaned) return { role: "", company: "" };

    const atMatch = cleaned.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) return { role: clean(atMatch[1]), company: clean(atMatch[2]) };

    const dotParts = cleaned.split(/\s*[·|@]\s*/).map(clean).filter(Boolean);
    if (dotParts.length >= 2) {
      return { role: dotParts[0], company: dotParts.slice(1).join(" · ") };
    }

    return { role: cleaned, company: "" };
  }

  function readMeta(key) {
    const node = document.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
    return clean(node?.content || node?.getAttribute?.("content"));
  }

  function headlineFromTitle(title) {
    const titleName = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    const dashParts = titleName.split(/\s+[-–—]\s+/);
    if (dashParts.length > 1) return dashParts.slice(1).join(" - ");
    return "";
  }

  function headlineFromOpenGraph() {
    const ogTitle = readMeta("og:title").replace(/\s*\|\s*LinkedIn\s*$/i, "");
    if (ogTitle) {
      const dashParts = ogTitle.split(/\s+[-–—]\s+/);
      if (dashParts.length > 1) return dashParts.slice(1).join(" - ");
    }
    return readMeta("og:description");
  }

  function headlineFromDom() {
    const selectors = [
      ".text-body-medium",
      "[data-generated-suggestion-target]",
      "div[data-view-name=\"profile-card\"] h2",
      ".pv-text-details__left-panel h2",
      ".top-card-layout__headline",
    ];
    for (const selector of selectors) {
      const value = clean(document.querySelector(selector)?.textContent);
      if (value && value.length <= 160) return value;
    }
    return "";
  }

  function headlineFromPageText(fullName) {
    const lines = (document.body?.innerText || "").split("\n").map(clean).filter(Boolean);
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

  function extractLinks() {
    let email = "";
    let phone = "";
    let companyWebsite = "";
    let personalWebsite = "";

    document.querySelectorAll("a[href^='mailto:'], a[href^='tel:'], a[href^='http']").forEach((node) => {
      const href = node.getAttribute("href") || "";
      if (!email && href.startsWith("mailto:")) email = clean(href.replace(/^mailto:/i, "").split("?")[0]);
      if (!phone && href.startsWith("tel:")) phone = clean(href.replace(/^tel:/i, "").split("?")[0]);
      if (!href.startsWith("http") || /linkedin\.com/i.test(href)) return;
      const label = clean(node.textContent).toLowerCase();
      const url = normalizeUrl(href);
      if (!personalWebsite && /portfolio|website|blog|site|personal/i.test(label)) personalWebsite = url;
      if (!companyWebsite && /company|employer|organization/i.test(label)) companyWebsite = url;
    });

    return { email, phone, companyWebsite, personalWebsite };
  }

  function captureLinkedInProfile() {
    const linkedinUrl = normalizeUrl(window.location.href.split("?")[0]);
    const titleName = document.title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    const h1 = clean(document.querySelector("h1")?.textContent);
    const ogTitle = readMeta("og:title").replace(/\s*\|\s*LinkedIn\s*$/i, "");
    const fullName = h1 || ogTitle.split(/\s+[-–—]\s+/)[0] || titleName.split(" - ")[0] || "";
    const { firstName, lastName } = splitName(fullName);
    const headline =
      headlineFromDom()
      || headlineFromOpenGraph()
      || headlineFromPageText(fullName)
      || headlineFromTitle(document.title);
    const { role, company } = parseHeadline(headline);
    const links = extractLinks();

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
      source: "extension",
    };
  }

  function captureCurrentPage() {
    if (/linkedin\.com\/in\//i.test(window.location.href)) return captureLinkedInProfile();
    return captureGenericProfile();
  }

  window.aftermeetCapturePage = function aftermeetCapturePage() {
    return {
      profile: captureCurrentPage(),
      pageText: document.body?.innerText?.slice(0, 6000) ?? "",
    };
  };
})();
