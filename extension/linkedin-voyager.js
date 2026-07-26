(function initAfterMeetLinkedInVoyager() {
  const API_BASE = "https://www.linkedin.com/voyager/api";
  const EXPERIENCE_QUERY_ID = "voyagerIdentityDashProfileComponents.7af5d6f176f11583b382e37e5639e69e";
  const DASH_TOP_CARD_DECORATION = "com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-6";

  function clean(value) {
    return (value ?? "").replace(/\s+/g, " ").trim();
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

  function parseDashTopCard(data) {
    for (const item of data?.included ?? []) {
      const headline = clean(item.headline) || clean(item.multiLocaleHeadline?.en_US);
      if (!headline) continue;
      const { role, company } = parseHeadline(headline);
      return {
        firstName: clean(item.firstName) || clean(item.multiLocaleFirstName?.en_US),
        lastName: clean(item.lastName) || clean(item.multiLocaleLastName?.en_US),
        urnId: urnIdFromEntityUrn(item.entityUrn),
        role,
        company,
      };
    }
    return {};
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
      if (typeof value.headline === "string" && !out.role) {
        const parsed = parseHeadline(value.headline);
        out.role = parsed.role;
        out.company = parsed.company;
      }
      if (typeof value.firstName === "string" && !out.firstName) out.firstName = clean(value.firstName);
      if (typeof value.lastName === "string" && !out.lastName) out.lastName = clean(value.lastName);
      if (typeof value.entityUrn === "string" && !out.urnId) out.urnId = urnIdFromEntityUrn(value.entityUrn);
      if (value.positionView?.elements?.length && !out.role) {
        const current = value.positionView.elements.find(isCurrentPosition) || value.positionView.elements[0];
        out.role = clean(current?.title);
        out.company = companyFromPosition(current);
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
      const match = html.match(/"headline"\s*:\s*"([^"]+)"/i);
      if (match) {
        const parsed = parseHeadline(match[1]);
        out.role = parsed.role;
        out.company = parsed.company;
      }
    }

    return out;
  }

  function findProfileUrnInPage() {
    const html = document.documentElement?.innerHTML ?? "";
    const match = html.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/)
      || html.match(/urn:li:fs_profile:([A-Za-z0-9_-]+)/);
    return match?.[1] ?? "";
  }

  function mergeFields(target, source) {
    ["firstName", "lastName", "role", "company", "email", "phone", "companyWebsite", "personalWebsite", "urnId"].forEach((field) => {
      const value = clean(source[field]);
      if (value) target[field] = value;
    });
    return target;
  }

  async function fetchDashTopCard(publicId) {
    return voyagerGet(
      `/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicId)}&decorationId=${DASH_TOP_CARD_DECORATION}`,
      true,
    );
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

    const [profileView, contactInfo, dashTopCard] = await Promise.all([
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileView`),
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileContactInfo`),
      fetchDashTopCard(id),
    ]);

    mergeFields(parsed, parseProfileView(profileView));
    mergeFields(parsed, parseContactInfo(contactInfo));
    mergeFields(parsed, parseDashTopCard(dashTopCard));

    if (!parsed.role || !parsed.company) {
      const urnId = parsed.urnId || findProfileUrnInPage();
      mergeFields(parsed, await fetchExperienceGraphql(urnId));
    }

    if (!parsed.firstName && !parsed.role && !parsed.email) return null;
    return parsed;
  };

  window.aftermeetLinkedInPublicId = parsePublicId;
})();
