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
    if (dotParts.length >= 2) return { role: dotParts[0], company: dotParts.slice(1).join(" · ") };
    return { role: cleaned, company: "" };
  }

  function stripEmploymentSuffix(value) {
    return clean(value.split(" · ")[0]?.split(" | ")[0]);
  }

  function isJunkProfileLine(line) {
    const value = clean(line);
    if (!value || value.length > 120) return true;
    if (/^\d+\+?\s*connections?$/i.test(value)) return true;
    if (/^(message|connect|follow|more|contact info|about|activity|posts|comments|videos|images|documents)$/i.test(value)) return true;
    if (/^(open to work|hiring|verified|premium|top voice|uk global talent)$/i.test(value)) return true;
    if (/^[A-Z][a-z]+(?:,\s*[A-Z][a-z]+){0,3},\s*[A-Z][a-z]+(?: Area)?(?:,\s*[A-Z][a-z]+)?$/.test(value)) return true;
    if (/^•/.test(value)) return true;
    if (/^(full-time|part-time|contract|self-employed|internship|freelance)$/i.test(value)) return true;
    if (/^\d{4}\s*[–-]\s*(present|\d{4})/i.test(value)) return true;
    return false;
  }

  function parseExperienceFromText(pageText) {
    const lines = pageText.split("\n").map(clean).filter(Boolean);
    const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));
    if (experienceIndex < 0) return { role: "", company: "" };
    const role = lines.slice(experienceIndex + 1).find((line) => !isJunkProfileLine(line) && line.length <= 80) || "";
    if (!role) return { role: "", company: "" };
    const roleIndex = lines.indexOf(role, experienceIndex + 1);
    const companyLine = lines.slice(roleIndex + 1).find((line) => {
      if (isJunkProfileLine(line) || line.length > 100) return false;
      return line.includes("·") || /full-time|part-time|contract|self-employed|internship|freelance/i.test(line);
    }) || "";
    if (companyLine) return { role, company: stripEmploymentSuffix(companyLine) };
    return parseHeadline(role);
  }

  function parseContactInfoFromText(pageText) {
    const lines = pageText.split("\n").map(clean).filter(Boolean);
    let email = "";
    let phone = "";
    for (const line of lines) {
      if (!email) {
        const match = line.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
        if (match) email = match[0].toLowerCase();
      }
    }
    const phoneIndex = lines.findIndex((line) => /^phone$/i.test(line));
    if (phoneIndex >= 0) {
      for (const line of lines.slice(phoneIndex + 1, phoneIndex + 4)) {
        const match = line.match(/(\+\d[\d\s().-]{7,}\d)/);
        if (match) {
          phone = match[1].replace(/[^\d+]/g, "").replace(/^\+/, "+");
          break;
        }
      }
    }
    if (!phone) {
      const match = pageText.match(/(\+\d[\d\s().-]{7,}\d)/);
      if (match) phone = match[1].replace(/[^\d+]/g, "").replace(/^\+/, "+");
    }
    return { email, phone };
  }

  function headlineFromPageText(pageText, fullName) {
    const lines = pageText.split("\n").map(clean).filter(Boolean);
    const nameIndex = lines.findIndex((line) => line === fullName || line.startsWith(fullName));
    if (nameIndex < 0) return "";
    for (let index = nameIndex + 1; index < Math.min(nameIndex + 6, lines.length); index += 1) {
      const candidate = lines[index];
      if (isJunkProfileLine(candidate)) continue;
      if (/ at | · /.test(candidate)) return candidate;
    }
    return "";
  }

  function mergeLinkedInRoleCompany(experience, headline) {
    const role = experience.role || headline.role;
    let company = experience.company || headline.company;
    if (company.length > 80 || /[•]|manage, lead|responsible for/i.test(company)) {
      company = experience.company || (headline.company.length <= 80 ? headline.company : "");
    }
    return { role, company };
  }

  function buildLinkedInCaptureContext(profile) {
    const parts = [];
    if (profile.role && profile.company) parts.push(`Current role: ${profile.role} at ${profile.company}.`);
    else if (profile.role) parts.push(`Current role: ${profile.role}.`);
    if (profile.email) parts.push(`Email visible on LinkedIn: ${profile.email}.`);
    if (profile.phone) parts.push(`Phone visible on LinkedIn: ${profile.phone}.`);
    if (profile.linkedinUrl) parts.push(`Profile: ${profile.linkedinUrl}.`);
    return parts.join(" ");
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
      const nodes = selector === ".text-body-medium"
        ? document.querySelectorAll(selector)
        : [document.querySelector(selector)].filter(Boolean);
      for (const node of nodes) {
        const value = clean(node?.textContent);
        if (!value || value.length > 120 || isJunkProfileLine(value)) continue;
        if (/ at | · /.test(value) || parseHeadline(value).company) return value;
      }
    }
    return "";
  }

  function captureExperienceFromDom() {
    const section = document.getElementById("experience")?.closest("section")
      || document.querySelector('[data-view-name="profile-card-experience"]')
      || document.querySelector("section.artdeco-card.pvs-loader__profile-card");
    if (!section) return { role: "", company: "" };

    const firstEntry = section.querySelector(".artdeco-list__item, li.pvs-list__paged-list-item, ul.pvs-list > li");
    if (!firstEntry) return { role: "", company: "" };

    const role = clean(
      firstEntry.querySelector(".t-bold span[aria-hidden=\"true\"]")?.textContent
      || firstEntry.querySelector(".mr1.hoverable-link-text span")?.textContent
      || firstEntry.querySelector(".t-bold")?.textContent,
    );
    const companyLine = clean(
      firstEntry.querySelector(".t-14.t-normal span[aria-hidden=\"true\"]")?.textContent
      || firstEntry.querySelector(".pv-entity__secondary-title")?.textContent
      || firstEntry.querySelector(".t-14.t-normal")?.textContent,
    );

    return {
      role,
      company: stripEmploymentSuffix(companyLine),
    };
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

  function captureLinkedInProfileFromDom() {
    const pageText = document.body?.innerText ?? "";
    const linkedinUrl = normalizeUrl(window.location.href.split("?")[0]);
    const titleName = document.title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    const h1 = clean(document.querySelector("h1")?.textContent);
    const ogTitle = readMeta("og:title").replace(/\s*\|\s*LinkedIn\s*$/i, "");
    const fullName = h1 || ogTitle.split(/\s+[-–—]\s+/)[0] || titleName.split(" - ")[0] || "";
    const { firstName, lastName } = splitName(fullName);

    const experience = parseExperienceFromText(pageText);
    const domExperience = captureExperienceFromDom();
    const headlineText =
      headlineFromDom()
      || headlineFromOpenGraph()
      || headlineFromPageText(pageText, fullName)
      || headlineFromTitle(document.title);
    const { role, company } = mergeLinkedInRoleCompany(
      {
        role: domExperience.role || experience.role,
        company: domExperience.company || experience.company,
      },
      parseHeadline(headlineText),
    );

    const links = extractLinks();
    const contact = parseContactInfoFromText(pageText);
    const email = links.email || contact.email;
    const phone = links.phone || contact.phone;

    return {
      firstName,
      lastName,
      email,
      phone,
      company,
      role,
      companyWebsite: links.companyWebsite,
      personalWebsite: links.personalWebsite,
      linkedinUrl,
      sourceUrl: linkedinUrl,
      source: "extension",
      context: buildLinkedInCaptureContext({ role, company, email, phone, linkedinUrl }),
    };
  }

  async function captureLinkedInProfile() {
    const domProfile = captureLinkedInProfileFromDom();
    const publicId = window.aftermeetLinkedInPublicId?.(window.location.href) || "";
    if (!publicId || typeof window.aftermeetFetchLinkedInVoyager !== "function") {
      return domProfile;
    }

    try {
      const voyager = await window.aftermeetFetchLinkedInVoyager(publicId);
      if (!voyager) return domProfile;

      const merged = { ...domProfile };
      ["firstName", "lastName", "role", "company", "email", "phone", "companyWebsite", "personalWebsite"].forEach((field) => {
        const value = clean(voyager[field]);
        if (value) merged[field] = value;
      });
      merged.context = buildLinkedInCaptureContext({
        role: merged.role,
        company: merged.company,
        email: merged.email,
        phone: merged.phone,
        linkedinUrl: merged.linkedinUrl,
      });
      return merged;
    } catch {
      return domProfile;
    }
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
      context: "",
    };
  }

  window.aftermeetCapturePage = async function aftermeetCapturePage() {
    const profile = /linkedin\.com\/in\//i.test(window.location.href)
      ? await captureLinkedInProfile()
      : captureGenericProfile();
    return {
      profile,
      pageText: document.body?.innerText?.slice(0, 8000) ?? "",
    };
  };
})();
