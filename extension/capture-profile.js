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

  function stripEmploymentSuffix(value) {
    return clean(value.split(" · ")[0]?.split(" | ")[0]);
  }

  function isValidExperienceRole(value) {
    const role = clean(value);
    if (!role || role.length > 80) return false;
    if (/^(uk global talent|open to work|hiring|verified|premium|top voice)$/i.test(role)) return false;
    if (/manage, lead|responsible for|i manage|^[•-]/i.test(role)) return false;
    return true;
  }

  function isValidExperienceCompany(value) {
    const company = clean(value);
    if (!company || company.length > 80) return false;
    if (/manage, lead|responsible for|i manage|^[•-]/i.test(company)) return false;
    return true;
  }

  function sanitizeExperience(input) {
    return {
      role: isValidExperienceRole(input.role) ? clean(input.role) : "",
      company: isValidExperienceCompany(input.company) ? stripEmploymentSuffix(input.company) : "",
    };
  }

  function isJunkExperienceLine(line) {
    const value = clean(line);
    if (!value || value.length > 100) return true;
    if (/^(uk global talent|open to work|hiring|verified|premium|top voice|show all)$/i.test(value)) return true;
    if (/^\d{4}\s*[–-]\s*(present|\d{4})/i.test(value)) return true;
    if (/manage, lead|responsible for|i manage/i.test(value)) return true;
    if (/^(full-time|part-time|contract|self-employed|internship|freelance)$/i.test(value)) return true;
    return false;
  }

  function parseExperienceSectionText(sectionText) {
    const lines = sectionText.split("\n").map(clean).filter(Boolean);
    const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));
    const startIndex = experienceIndex >= 0 ? experienceIndex + 1 : 0;
    const role = lines.slice(startIndex).find((line) => !isJunkExperienceLine(line) && line.length <= 80) || "";
    if (!role) return { role: "", company: "" };

    const roleIndex = lines.indexOf(role, startIndex);
    const companyLine = lines.slice(roleIndex + 1).find((line) => {
      if (isJunkExperienceLine(line)) return false;
      return line.includes("·") || /full-time|part-time|contract|self-employed|internship|freelance/i.test(line);
    }) || "";

    return sanitizeExperience({
      role,
      company: companyLine ? stripEmploymentSuffix(companyLine) : "",
    });
  }

  function findExperienceSection() {
    const anchor = document.getElementById("experience");
    if (!anchor) return null;
    return anchor.closest("section")
      || anchor.closest(".artdeco-card")
      || anchor.parentElement;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function scrollContainerFor(node) {
    return node?.closest("main")
      || document.querySelector("main.scaffold-layout__main, .scaffold-layout__main")
      || document.documentElement;
  }

  function scrollNodeIntoView(node) {
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "instant" });
    const container = scrollContainerFor(node);
    if (container && container !== document.documentElement && container !== document.body) {
      const rect = node.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      container.scrollTop += rect.top - containerRect.top - container.clientHeight / 2;
    }
    window.dispatchEvent(new Event("scroll", { bubbles: true }));
  }

  function findExperienceAnchor() {
    return document.getElementById("experience")
      || document.querySelector('[data-view-name*="experience" i], [componentkey*="Experience"]');
  }

  function hasCompleteExperience(input) {
    return isValidExperienceRole(input.role) && isValidExperienceCompany(input.company);
  }

  async function revealExperienceSection() {
    let anchor = findExperienceAnchor();

    for (let step = 0; !anchor && step < 10; step += 1) {
      window.scrollBy({ top: Math.round(window.innerHeight * 0.75), behavior: "instant" });
      const container = scrollContainerFor(document.body);
      if (container && container.scrollBy) {
        container.scrollBy({ top: Math.round(window.innerHeight * 0.75), behavior: "instant" });
      }
      await sleep(280);
      anchor = findExperienceAnchor();
    }

    if (!anchor) {
      return sanitizeExperience(parseExperienceSectionText(document.body?.innerText ?? ""));
    }

    for (let attempt = 0; attempt < 16; attempt += 1) {
      scrollNodeIntoView(anchor);
      const section = findExperienceSection();
      const captured = captureExperienceFromSection(section);
      if (hasCompleteExperience(captured)) return captured;

      const showMore = section?.querySelector(
        'a[href*="details/experience"], button[aria-label*="experience" i], .pvs-list__footer-wrapper a',
      );
      showMore?.click?.();

      await sleep(320);
    }

    const section = findExperienceSection();
    const captured = captureExperienceFromSection(section);
    if (captured.role || captured.company) return captured;

    return sanitizeExperience(parseExperienceSectionText(document.body?.innerText ?? ""));
  }

  function captureExperienceFromSection(section) {
    if (!section) return { role: "", company: "" };

    const entries = section.querySelectorAll(
      "li.pvs-list__paged-list-item, li.artdeco-list__item, [data-view-name=\"profile-component-entity\"]",
    );
    const firstEntry = entries[0];
    if (firstEntry) {
      const hiddenSpans = [...firstEntry.querySelectorAll('span[aria-hidden="true"]')]
        .map((node) => clean(node.textContent))
        .filter(Boolean);

      if (hiddenSpans.length >= 2) {
        const parsed = sanitizeExperience({
          role: hiddenSpans[0],
          company: stripEmploymentSuffix(hiddenSpans[1]),
        });
        if (parsed.role && parsed.company) return parsed;
      }

      const role = clean(
        firstEntry.querySelector('.t-bold span[aria-hidden="true"]')?.textContent
        || firstEntry.querySelector(".mr1.hoverable-link-text span")?.textContent
        || firstEntry.querySelector(".t-bold")?.textContent,
      );
      const companyLine = clean(
        firstEntry.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent
        || firstEntry.querySelector(".t-14.t-normal")?.textContent,
      );
      const parsed = sanitizeExperience({
        role,
        company: stripEmploymentSuffix(companyLine),
      });
      if (parsed.role && parsed.company) return parsed;
    }

    return parseExperienceSectionText(section.innerText || "");
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
    return { email, phone };
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

  function extractLinks() {
    let email = "";
    let phone = "";
    document.querySelectorAll("a[href^='mailto:'], a[href^='tel:']").forEach((node) => {
      const href = node.getAttribute("href") || "";
      if (!email && href.startsWith("mailto:")) email = clean(href.replace(/^mailto:/i, "").split("?")[0]);
      if (!phone && href.startsWith("tel:")) phone = clean(href.replace(/^tel:/i, "").split("?")[0]);
    });
    return { email, phone };
  }

  function captureLinkedInProfileBase() {
    const pageText = document.body?.innerText ?? "";
    const linkedinUrl = normalizeUrl(window.location.href.split("?")[0]);
    const h1 = clean(document.querySelector("h1")?.textContent);
    const ogTitle = readMeta("og:title").replace(/\s*\|\s*LinkedIn\s*$/i, "");
    const fullName = h1 || ogTitle.split(/\s+[-–—]\s+/)[0] || document.title.split(" - ")[0] || "";
    const { firstName, lastName } = splitName(fullName);

    const links = extractLinks();
    const contact = parseContactInfoFromText(pageText);
    const email = links.email || contact.email;
    const phone = links.phone || contact.phone;

    return {
      firstName,
      lastName,
      email,
      phone,
      company: "",
      role: "",
      companyWebsite: "",
      personalWebsite: "",
      linkedinUrl,
      sourceUrl: linkedinUrl,
      source: "extension",
      context: "",
    };
  }

  async function captureLinkedInProfile() {
    const publicId = window.aftermeetLinkedInPublicId?.(window.location.href) || "";
    const baseProfile = captureLinkedInProfileBase();

    let voyager = null;
    if (publicId && typeof window.aftermeetFetchLinkedInVoyager === "function") {
      try {
        voyager = await window.aftermeetFetchLinkedInVoyager(publicId);
      } catch {
        voyager = null;
      }
    }

    let { role, company } = voyager
      ? sanitizeExperience({ role: voyager.role, company: voyager.company })
      : { role: "", company: "" };

    if (!hasCompleteExperience({ role, company }) && publicId && typeof window.aftermeetFetchLinkedInExperience === "function") {
      try {
        const experience = await window.aftermeetFetchLinkedInExperience(publicId, voyager ?? {});
        role = role || experience.role;
        company = company || experience.company;
      } catch {
        /* keep voyager values if any */
      }
    }

    if (!hasCompleteExperience({ role, company })) {
      const domExperience = await revealExperienceSection();
      role = role || domExperience.role;
      company = company || domExperience.company;
    }

    const merged = {
      ...baseProfile,
      role,
      company,
    };

    if (voyager) {
      ["firstName", "lastName", "email", "phone"].forEach((field) => {
        const value = clean(voyager[field]);
        if (value) merged[field] = value;
      });
    }

    merged.context = buildLinkedInCaptureContext({
      role: merged.role,
      company: merged.company,
      email: merged.email,
      phone: merged.phone,
      linkedinUrl: merged.linkedinUrl,
    });
    return merged;
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
      companyWebsite: "",
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
