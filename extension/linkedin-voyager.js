(function initAfterMeetLinkedInVoyager() {
  const API_BASE = "https://www.linkedin.com/voyager/api";
  const FALLBACK_EXPERIENCE_QUERY_IDS = [
    "voyagerIdentityDashProfileComponents.7af5d6f176f11583b382e37e5639e69e",
    "voyagerIdentityDashProfileCards.2d68c43b54ee24f8de25bc423c3cf7e4",
  ];
  const DASH_PROFILE_DECORATIONS = [
    "com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93",
    "com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-76",
    "com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-6",
  ];

  let experienceCache = null;
  let experienceCacheKey = "";
  let contactCache = null;
  let contactCacheKey = "";

  function clean(value) {
    const raw = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!raw || !/&/.test(raw)) return raw;
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = raw;
      return textarea.value.replace(/\s+/g, " ").trim();
    }
    return raw.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");
  }

  function parsePublicId(url) {
    const match = String(url).match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match?.[1]?.replace(/\/+$/, "") ?? "";
  }

  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)JSESSIONID="?([^";]+)"?/);
    return match ? match[1].replace(/"/g, "") : "";
  }

  async function voyagerGet(path, normalized = false, referer) {
    const token = csrfToken();
    if (!token) return null;

    const headers = {
      accept: normalized ? "application/vnd.linkedin.normalized+json+2.1" : "application/json",
      "csrf-token": token,
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
    };
    if (referer) headers.Referer = referer;

    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers,
    });
    if (!response.ok) return null;
    return response.json();
  }

  function urnIdFromEntityUrn(urn) {
    const value = clean(urn);
    if (!value) return "";
    return value.split(":").pop() || "";
  }

  function isCurrentPosition(item) {
    const endDate = item?.timePeriod?.endDate;
    if (!endDate) return true;
    return !endDate.year;
  }

  function companyFromPosition(item) {
    if (!item) return "";
    return clean(item.companyName)
      || clean(item.company?.miniCompany?.name)
      || clean(item.company?.name);
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

  function stripEmploymentSuffix(value) {
    return clean(value.split(" · ")[0]?.split(" | ")[0]);
  }

  function sanitizeExperience(input) {
    return {
      role: isValidExperienceRole(input.role) ? clean(input.role) : "",
      company: isValidExperienceCompany(input.company) ? stripEmploymentSuffix(input.company) : "",
    };
  }

  function hasCompleteExperience(input) {
    return Boolean(input.role && input.company);
  }

  function mergeExperienceFields(target, source) {
    const parsed = sanitizeExperience(source);
    if (parsed.role) target.role = parsed.role;
    if (parsed.company) target.company = parsed.company;
    return target;
  }

  function parseProfileView(data) {
    if (!data || (typeof data.status === "number" && data.status !== 200)) return {};
    const profile = data.profile ?? {};
    const miniProfile = profile.miniProfile ?? {};
    const current = (data.positionView?.elements ?? []).find(isCurrentPosition)
      ?? data.positionView?.elements?.[0];

    return {
      firstName: clean(profile.firstName) || clean(miniProfile.firstName),
      lastName: clean(profile.lastName) || clean(miniProfile.lastName),
      publicId: clean(miniProfile.publicIdentifier),
      urnId: urnIdFromEntityUrn(profile.entityUrn || miniProfile.entityUrn),
      role: clean(current?.title),
      company: companyFromPosition(current),
    };
  }

  function websiteLabel(item) {
    const type = item?.type ?? {};
    return clean(type["com.linkedin.voyager.identity.profile.StandardWebsite"]?.category)
      || clean(type["com.linkedin.voyager.identity.profile.CustomWebsite"]?.label);
  }

  function parseContactInfo(data) {
    if (!data) return { email: "", phone: "" };

    let companyWebsite = "";
    let personalWebsite = "";
    for (const item of data.websites ?? []) {
      const url = clean(item?.url);
      if (!url) continue;
      const label = websiteLabel(item).toLowerCase();
      if (!personalWebsite && /portfolio|personal|blog|other|website/.test(label)) personalWebsite = url;
      if (!companyWebsite && /company|employer|organization/.test(label)) companyWebsite = url;
      if (!personalWebsite && !companyWebsite) personalWebsite = url;
    }

    let phone = "";
    for (const item of data.phoneNumbers ?? []) {
      phone = normalizePhone(item?.number);
      if (phone) break;
    }

    return {
      email: clean(data.emailAddress).toLowerCase(),
      phone,
      companyWebsite,
      personalWebsite,
    };
  }

  function parseContactInfoResponse(data) {
    const direct = parseContactInfo(data);
    if (direct.email || direct.phone) return direct;

    for (const item of data?.included ?? []) {
      const parsed = parseContactInfo(item);
      if (parsed.email || parsed.phone) return parsed;
      if (item?.data && typeof item.data === "object") {
        const nested = parseContactInfo(item.data);
        if (nested.email || nested.phone) return nested;
      }
    }

    return direct;
  }

  function parseContactFromStream(text) {
    const result = { email: "", phone: "" };
    mergeContactFields(result, parseEmbeddedFromHtml(text));
    mergeContactFields(result, parseContactInfoFromText(text));

    const chunks = text.match(/\{[^{}]*"emailAddress"[^{}]*\}/g) ?? [];
    for (const chunk of chunks) {
      try {
        mergeContactFields(result, parseContactInfo(JSON.parse(chunk)));
      } catch {
        /* ignore malformed chunks */
      }
    }

    if (!result.email) {
      const match = text.match(/"emailAddress"\s*:\s*"([^"]+)"/i);
      if (match) result.email = match[1].toLowerCase();
    }
    if (!result.phone) {
      const match = text.match(/"phoneNumbers"\s*:\s*\[\s*\{[^}]*"number"\s*:\s*"([^"]+)"/i);
      if (match) result.phone = normalizePhone(match[1]);
    }

    return result;
  }

  function discoverContactInfoQueryIds() {
    const html = document.documentElement?.innerHTML ?? "";
    return [...new Set(html.match(/voyagerIdentityDashProfileContactInfo\.[a-f0-9]{32}/gi) ?? [])];
  }

  async function fetchContactInfoGraphql(urnId, publicId) {
    const id = clean(urnId) || findProfileUrnInPage();
    if (!id) return { email: "", phone: "" };

    const referer = `https://www.linkedin.com/in/${encodeURIComponent(clean(publicId))}/`;
    const queryIds = discoverContactInfoQueryIds();
    for (const queryId of queryIds) {
      const variables = `(profileUrn:urn:li:fsd_profile:${id})`;
      const data = await voyagerGet(
        `/graphql?includeWebMetadata=true&variables=${variables}&queryId=${queryId}`,
        true,
        referer,
      );
      const parsed = parseContactInfoResponse(data);
      if (parsed.email || parsed.phone) return { email: parsed.email, phone: parsed.phone };
    }
    return { email: "", phone: "" };
  }

  async function fetchSduiContactInfo(publicId, urnId) {
    const token = csrfToken();
    const id = clean(publicId);
    if (!token || !id) return { email: "", phone: "" };

    const referer = `https://www.linkedin.com/in/${encodeURIComponent(id)}/`;
    const profileUrn = clean(urnId) ? `urn:li:fsd_profile:${clean(urnId)}` : "";
    const urls = [
      "https://www.linkedin.com/flagship-web/rsc-action/voyagerIdentityDashProfileContactInfo",
    ];
    const bodies = [
      { profileUrn, vanityName: id, publicIdentifier: id },
      { variables: { profileUrn, vanityName: id } },
      { memberIdentity: id },
    ];

    for (const url of urls) {
      for (const body of bodies) {
        try {
          const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
              accept: "*/*",
              "content-type": "application/json",
              "csrf-token": token,
              "x-restli-protocol-version": "2.0.0",
              Referer: referer,
            },
            body: JSON.stringify(body),
          });
          if (!response.ok) continue;
          const parsed = parseContactFromStream(await response.text());
          if (parsed.email || parsed.phone) return parsed;
        } catch {
          /* try next body */
        }
      }
    }

    return { email: "", phone: "" };
  }

  function normalizePhone(value) {
    const cleaned = clean(value);
    if (!cleaned) return "";
    const match = cleaned.match(/(\+\d[\d\s().-]{7,}\d)/);
    if (!match) return cleaned.replace(/[^\d+]/g, "").replace(/^\+/, "+");
    return match[1].replace(/[^\d+]/g, "").replace(/^\+/, "+");
  }

  function mergeContactFields(target, source) {
    const email = clean(source.email).toLowerCase();
    const phone = normalizePhone(source.phone);
    if (email) target.email = email;
    if (phone) target.phone = phone;
    return target;
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

    const emailIndex = lines.findIndex((line) => /^email$/i.test(line));
    if (emailIndex >= 0 && !email) {
      for (const line of lines.slice(emailIndex + 1, emailIndex + 4)) {
        const match = line.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
        if (match) {
          email = match[0].toLowerCase();
          break;
        }
      }
    }

    const phoneIndex = lines.findIndex((line) => /^phone$/i.test(line));
    if (phoneIndex >= 0) {
      for (const line of lines.slice(phoneIndex + 1, phoneIndex + 4)) {
        const normalized = normalizePhone(line);
        if (normalized) {
          phone = normalized;
          break;
        }
      }
    }

    if (!phone) {
      const match = pageText.match(/(\+\d[\d\s().-]{7,}\d)/);
      if (match) phone = normalizePhone(match[1]);
    }

    return { email, phone };
  }

  async function fetchContactInfoOverlayPage(publicId) {
    const id = clean(publicId);
    if (!id) return { email: "", phone: "" };

    const referer = `https://www.linkedin.com/in/${encodeURIComponent(id)}/`;
    const response = await fetch(`${referer}overlay/contact-info/`, {
      credentials: "include",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "x-restli-protocol-version": "2.0.0",
      },
    });
    if (!response.ok) return { email: "", phone: "" };

    const html = await response.text();
    const embedded = parseEmbeddedFromHtml(html);
    const text = parseContactInfoFromText(htmlToVisibleText(html));
    return {
      email: embedded.email || text.email,
      phone: embedded.phone || text.phone,
    };
  }

  async function fetchLinkedInContactInfo(publicId) {
    const id = clean(publicId);
    if (!id) return { email: "", phone: "" };

    const cacheKey = `${id}:contact`;
    if (contactCache && contactCacheKey === cacheKey) return contactCache;

    const result = { email: "", phone: "" };
    const seed = parseEmbeddedSnapshot();
    mergeContactFields(result, seed);

    const referer = `https://www.linkedin.com/in/${encodeURIComponent(id)}/`;
    const [apiJson, apiNormalized, sdui, graphql, overlay] = await Promise.all([
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileContactInfo`, false, referer),
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileContactInfo`, true, referer),
      fetchSduiContactInfo(id, seed.urnId),
      fetchContactInfoGraphql(seed.urnId, id),
      fetchContactInfoOverlayPage(id),
    ]);

    mergeContactFields(result, parseContactInfoResponse(apiJson));
    mergeContactFields(result, parseContactInfoResponse(apiNormalized));
    mergeContactFields(result, sdui);
    mergeContactFields(result, graphql);
    mergeContactFields(result, overlay);

    if (result.email || result.phone) {
      contactCache = result;
      contactCacheKey = cacheKey;
    }
    return result;
  }

  function parseGraphqlExperienceItem(item) {
    const entity = item?.components?.entityComponent;
    if (!entity) return null;

    const title = clean(entity.titleV2?.text?.text || entity.title?.text);
    if (!title) return null;

    const subtitle = clean(entity.subtitle?.text);
    const company = subtitle ? stripEmploymentSuffix(subtitle) : "";
    const caption = clean(entity.caption?.text);
    return {
      role: title,
      company,
      isCurrent: /present/i.test(caption) || !/\d{4}\s*[–-]\s*\d{4}/i.test(caption),
    };
  }

  function parseExperienceGraphql(data) {
    const parsedItems = [];

    for (const block of data?.included ?? []) {
      for (const item of block?.components?.elements ?? []) {
        const parsed = parseGraphqlExperienceItem(item);
        if (parsed) parsedItems.push(parsed);
      }

      const fixedList = block?.components?.fixedListComponent?.components ?? [];
      for (const item of fixedList) {
        const parsed = parseGraphqlExperienceItem(item);
        if (parsed) parsedItems.push(parsed);
      }
    }

    const current = parsedItems.find((item) => item.isCurrent) ?? parsedItems[0];
    if (!current) return { role: "", company: "" };
    return { role: current.role, company: current.company };
  }

  function walkEmbeddedSnapshot(value, out) {
    if (!value || typeof value !== "object") return;

    if (!Array.isArray(value)) {
      if (typeof value.emailAddress === "string" && !out.email) out.email = value.emailAddress.toLowerCase();
      if (Array.isArray(value.phoneNumbers) && !out.phone) out.phone = clean(value.phoneNumbers[0]?.number);
      if (typeof value.firstName === "string" && !out.firstName) out.firstName = clean(value.firstName);
      if (typeof value.lastName === "string" && !out.lastName) out.lastName = clean(value.lastName);
      if (typeof value.entityUrn === "string" && !out.urnId) out.urnId = urnIdFromEntityUrn(value.entityUrn);
      if (typeof value.companyName === "string" && !out.company) out.company = clean(value.companyName);
      if (typeof value.title === "string" && !out.role && isValidExperienceRole(value.title)) {
        out.role = clean(value.title);
      }
      if (value.positionView?.elements?.length) {
        const current = value.positionView.elements.find(isCurrentPosition) || value.positionView.elements[0];
        if (!out.role) out.role = clean(current?.title);
        if (!out.company) out.company = companyFromPosition(current);
      }
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walkEmbeddedSnapshot(item, out));
      return;
    }

    Object.values(value).forEach((item) => walkEmbeddedSnapshot(item, out));
  }

  function parseEmbeddedFromHtml(html) {
    const out = {
      firstName: "",
      lastName: "",
      role: "",
      company: "",
      email: "",
      phone: "",
      urnId: "",
    };

    const codeBlocks = html.match(/<code[^>]*id="[^"]*bpr-guid[^"]*"[^>]*>[\s\S]*?<\/code>/gi) ?? [];
    for (const block of codeBlocks) {
      const text = block.replace(/^[\s\S]*?>/, "").replace(/<\/code>[\s\S]*$/, "").trim();
      if (!text.startsWith("{")) continue;
      try {
        walkEmbeddedSnapshot(JSON.parse(text), out);
      } catch {
        /* ignore malformed chunks */
      }
    }

    const jsonLike = html.match(/\{"data":\{[\s\S]{100,50000}?\}\}/g) ?? [];
    for (const chunk of jsonLike.slice(0, 8)) {
      try {
        walkEmbeddedSnapshot(JSON.parse(chunk), out);
      } catch {
        /* ignore malformed chunks */
      }
    }

    if (!out.email) {
      const match = html.match(/"emailAddress"\s*:\s*"([^"]+)"/i);
      if (match) out.email = match[1].toLowerCase();
    }
    if (!out.phone) {
      const match = html.match(/"phoneNumbers"\s*:\s*\[\s*\{[^}]*"number"\s*:\s*"([^"]+)"/i);
      if (match) out.phone = match[1];
    }
    if (!out.role) {
      const match = html.match(/"title"\s*:\s*"([^"]+)"/i);
      if (match && isValidExperienceRole(match[1])) out.role = match[1];
    }
    if (!out.company) {
      const match = html.match(/"companyName"\s*:\s*"([^"]+)"/i);
      if (match && isValidExperienceCompany(match[1])) out.company = match[1];
    }
    if (!out.urnId) {
      const match = html.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/)
        || html.match(/urn:li:fs_profile:([A-Za-z0-9_-]+)/);
      if (match) out.urnId = match[1];
    }

    return out;
  }

  function parseEmbeddedSnapshot() {
    return parseEmbeddedFromHtml(document.documentElement?.innerHTML ?? "");
  }

  function discoverExperienceQueryIds() {
    const html = document.documentElement?.innerHTML ?? "";
    const ids = new Set(FALLBACK_EXPERIENCE_QUERY_IDS);
    const patterns = [
      /voyagerIdentityDashProfileComponents\.[a-f0-9]{32}/gi,
      /voyagerIdentityDashProfileCards\.[a-f0-9]{32}/gi,
    ];
    for (const pattern of patterns) {
      const matches = html.match(pattern) ?? [];
      matches.forEach((id) => ids.add(id));
    }
    return [...ids];
  }

  function parseExperienceSectionText(sectionText) {
    const lines = sectionText.split("\n").map(clean).filter(Boolean);
    const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));
    const startIndex = experienceIndex >= 0 ? experienceIndex + 1 : 0;
    const role = lines.slice(startIndex).find((line) => {
      if (!line || line.length > 80) return false;
      if (/^(uk global talent|open to work|hiring|verified|premium|top voice|show all)$/i.test(line)) return false;
      if (/^\d{4}\s*[–-]\s*(present|\d{4})/i.test(line)) return false;
      if (/manage, lead|responsible for|i manage/i.test(line)) return false;
      if (/^(full-time|part-time|contract|self-employed|internship|freelance)$/i.test(line)) return false;
      return true;
    }) || "";
    if (!role) return { role: "", company: "" };

    const roleIndex = lines.indexOf(role, startIndex);
    const companyLine = lines.slice(roleIndex + 1).find((line) => {
      if (!line || /manage, lead|responsible for|i manage/i.test(line)) return false;
      return line.includes("·") || /full-time|part-time|contract|self-employed|internship|freelance/i.test(line);
    }) || "";

    return sanitizeExperience({
      role,
      company: companyLine ? stripEmploymentSuffix(companyLine) : "",
    });
  }

  function htmlToVisibleText(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/\n+/g, "\n");
  }

  function findProfileUrnInPage() {
    const html = document.documentElement?.innerHTML ?? "";
    const match = html.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/)
      || html.match(/urn:li:fs_profile:([A-Za-z0-9_-]+)/);
    return match?.[1] ?? "";
  }

  function mergeFields(target, source) {
    ["firstName", "lastName", "email", "phone", "urnId"].forEach((field) => {
      const value = clean(source[field]);
      if (value) target[field] = value;
    });
    mergeExperienceFields(target, source);
    return target;
  }

  async function fetchExperienceDetailsPage(publicId) {
    const id = clean(publicId);
    if (!id) return { role: "", company: "" };

    const referer = `https://www.linkedin.com/in/${encodeURIComponent(id)}/`;
    const response = await fetch(`${referer}details/experience/`, {
      credentials: "include",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "x-restli-protocol-version": "2.0.0",
      },
    });
    if (!response.ok) return { role: "", company: "" };

    const html = await response.text();
    const embedded = parseEmbeddedFromHtml(html);
    const parsed = sanitizeExperience(embedded);
    if (hasCompleteExperience(parsed)) return parsed;

    return parseExperienceSectionText(htmlToVisibleText(html));
  }

  async function fetchExperienceGraphql(urnId, queryId) {
    const id = clean(urnId);
    const qid = clean(queryId);
    if (!id || !qid) return { role: "", company: "" };

    const variables = `(profileUrn:urn:li:fsd_profile:${id},sectionType:experience)`;
    const data = await voyagerGet(
      `/graphql?includeWebMetadata=true&variables=${variables}&queryId=${qid}`,
      true,
    );
    return parseExperienceGraphql(data);
  }

  async function fetchExperienceGraphqlWithDiscovery(urnId) {
    const id = clean(urnId);
    if (!id) return { role: "", company: "" };

    for (const queryId of discoverExperienceQueryIds()) {
      const parsed = sanitizeExperience(await fetchExperienceGraphql(id, queryId));
      if (hasCompleteExperience(parsed)) return parsed;
    }
    return { role: "", company: "" };
  }

  function parseDashProfileExperience(data) {
    for (const item of data?.included ?? []) {
      const positions = item?.profilePositionGroups?.elements
        ?? item?.positionGroups?.elements
        ?? item?.profilePositionGroups
        ?? [];

      const groups = Array.isArray(positions) ? positions : [];
      for (const group of groups) {
        const entries = group?.profilePositions?.elements ?? group?.elements ?? [group];
        const list = Array.isArray(entries) ? entries : [entries];
        const current = list.find(isCurrentPosition) ?? list[0];
        const parsed = sanitizeExperience({
          role: clean(current?.title),
          company: companyFromPosition(current),
        });
        if (hasCompleteExperience(parsed)) return parsed;
      }

      const parsed = sanitizeExperience({
        role: clean(item.title),
        company: companyFromPosition(item),
      });
      if (hasCompleteExperience(parsed)) return parsed;
    }
    return { role: "", company: "" };
  }

  async function fetchDashProfileExperience(publicId) {
    const id = clean(publicId);
    if (!id) return { role: "", company: "" };

    for (const decorationId of DASH_PROFILE_DECORATIONS) {
      const data = await voyagerGet(
        `/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(id)}&decorationId=${encodeURIComponent(decorationId)}`,
        true,
        `https://www.linkedin.com/in/${encodeURIComponent(id)}/`,
      );
      const parsed = parseDashProfileExperience(data);
      if (hasCompleteExperience(parsed)) return parsed;
    }
    return { role: "", company: "" };
  }

  async function resolveLinkedInExperience(publicId, seed = {}) {
    const id = clean(publicId);
    if (!id) return { role: "", company: "" };

    const merged = sanitizeExperience(seed);
    if (hasCompleteExperience(merged)) return merged;

    const urnId = clean(seed.urnId) || findProfileUrnInPage();

    const [detailsPage, dashProfile, graphql] = await Promise.all([
      fetchExperienceDetailsPage(id),
      fetchDashProfileExperience(id),
      fetchExperienceGraphqlWithDiscovery(urnId),
    ]);

    for (const candidate of [detailsPage, dashProfile, graphql]) {
      mergeExperienceFields(merged, candidate);
      if (hasCompleteExperience(merged)) break;
    }

    return sanitizeExperience(merged);
  }

  async function fetchLinkedInExperience(publicId, seed = {}) {
    const cacheKey = clean(publicId);
    if (experienceCache && experienceCacheKey === cacheKey) {
      const cached = sanitizeExperience(experienceCache);
      if (hasCompleteExperience(cached)) return cached;
    }

    const resolved = await resolveLinkedInExperience(publicId, seed);
    if (hasCompleteExperience(resolved)) {
      experienceCache = resolved;
      experienceCacheKey = cacheKey;
    }
    return resolved;
  }

  window.aftermeetFetchLinkedInVoyager = async function aftermeetFetchLinkedInVoyager(publicId) {
    const id = clean(publicId);
    if (!id) return null;

    const parsed = { ...parseEmbeddedSnapshot() };

    const [profileView, contactInfo] = await Promise.all([
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileView`, false, `https://www.linkedin.com/in/${encodeURIComponent(id)}/`),
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileContactInfo`, false, `https://www.linkedin.com/in/${encodeURIComponent(id)}/`),
    ]);

    mergeFields(parsed, parseProfileView(profileView));
    mergeContactFields(parsed, parseContactInfoResponse(contactInfo));

    if (!hasCompleteExperience(parsed)) {
      mergeExperienceFields(parsed, await fetchLinkedInExperience(id, parsed));
    }

    if (!parsed.firstName && !parsed.role && !parsed.email) return null;
    return parsed;
  };

  window.aftermeetFetchLinkedInExperience = fetchLinkedInExperience;

  window.aftermeetFetchLinkedInContactInfo = fetchLinkedInContactInfo;

  window.aftermeetPrefetchLinkedInExperience = function aftermeetPrefetchLinkedInExperience(publicId) {
    const id = clean(publicId);
    if (!id) return;
    const seed = parseEmbeddedSnapshot();
    void fetchLinkedInExperience(id, seed);
    void fetchLinkedInContactInfo(id);
  };

  window.aftermeetLinkedInPublicId = parsePublicId;
})();
