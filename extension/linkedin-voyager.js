(function initAfterMeetLinkedInVoyager() {
  const API_BASE = "https://www.linkedin.com/voyager/api";
  const EXPERIENCE_QUERY_ID = "voyagerIdentityDashProfileComponents.7af5d6f176f11583b382e37e5639e69e";
  function clean(value) {
    return (value ?? "").replace(/\s+/g, " ").trim();
  }

  function parsePublicId(url) {
    const match = String(url).match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match?.[1]?.replace(/\/+$/, "") ?? "";
  }

  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)JSESSIONID="?([^";]+)"?/);
    return match ? match[1].replace(/"/g, "") : "";
  }

  async function voyagerGet(path, normalized = false) {
    const token = csrfToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {
        accept: normalized ? "application/vnd.linkedin.normalized+json+2.1" : "application/json",
        "csrf-token": token,
        "x-restli-protocol-version": "2.0.0",
        "x-li-lang": "en_US",
      },
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
    if (!data) return {};
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
    return {
      email: clean(data.emailAddress).toLowerCase(),
      phone: clean(data.phoneNumbers?.[0]?.number),
      companyWebsite,
      personalWebsite,
    };
  }

  function parseGraphqlExperienceItem(item) {
    const entity = item?.components?.entityComponent;
    if (!entity?.titleV2?.text?.text) return null;
    const title = clean(entity.titleV2.text.text);
    const subtitle = clean(entity.subtitle?.text);
    const company = subtitle ? subtitle.split(" · ")[0] : "";
    const caption = clean(entity.caption?.text);
    return {
      role: title,
      company,
      isCurrent: /present/i.test(caption) || !/\d{4}\s*-\s*\d{4}/i.test(caption),
    };
  }

  function parseExperienceGraphql(data) {
    const parsedItems = [];
    for (const block of data?.included ?? []) {
      for (const item of block?.components?.elements ?? []) {
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

  function parseEmbeddedSnapshot() {
    const out = {
      firstName: "",
      lastName: "",
      role: "",
      company: "",
      email: "",
      phone: "",
      urnId: "",
    };

    document.querySelectorAll('code[id*="bpr-guid"]').forEach((node) => {
      const text = node.textContent?.trim();
      if (!text?.startsWith("{")) return;
      try {
        walkEmbeddedSnapshot(JSON.parse(text), out);
      } catch {
        /* ignore malformed chunks */
      }
    });

    const html = document.documentElement?.innerHTML ?? "";
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

    return out;
  }

  function findProfileUrnInPage() {
    const html = document.documentElement?.innerHTML ?? "";
    const match = html.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/)
      || html.match(/urn:li:fs_profile:([A-Za-z0-9_-]+)/);
    return match?.[1] ?? "";
  }

  function mergeExperienceFields(target, source) {
    if (isValidExperienceRole(source.role)) target.role = clean(source.role);
    if (isValidExperienceCompany(source.company)) target.company = stripEmploymentSuffix(source.company);
    return target;
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

  function mergeFields(target, source) {
    ["firstName", "lastName", "email", "phone", "urnId"].forEach((field) => {
      const value = clean(source[field]);
      if (value) target[field] = value;
    });
    mergeExperienceFields(target, source);
    return target;
  }

  async function fetchExperienceGraphql(urnId) {
    const id = clean(urnId);
    if (!id) return { role: "", company: "" };
    const variables = `(profileUrn:urn:li:fsd_profile:${id},sectionType:experience)`;
    const data = await voyagerGet(
      `/graphql?includeWebMetadata=true&variables=${variables}&queryId=${EXPERIENCE_QUERY_ID}`,
      true,
    );
    return parseExperienceGraphql(data);
  }

  window.aftermeetFetchLinkedInVoyager = async function aftermeetFetchLinkedInVoyager(publicId) {
    const id = clean(publicId);
    if (!id) return null;

    const parsed = { ...parseEmbeddedSnapshot() };

    const [profileView, contactInfo] = await Promise.all([
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileView`),
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileContactInfo`),
    ]);

    mergeFields(parsed, parseProfileView(profileView));
    mergeFields(parsed, parseContactInfo(contactInfo));

    if (!parsed.role || !parsed.company) {
      const urnId = parsed.urnId || findProfileUrnInPage();
      mergeFields(parsed, await fetchExperienceGraphql(urnId));
    }

    if (!parsed.firstName && !parsed.role && !parsed.email) return null;
    return parsed;
  };

  window.aftermeetLinkedInPublicId = parsePublicId;
})();
