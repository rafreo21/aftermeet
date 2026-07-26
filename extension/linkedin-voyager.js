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

    const headers = {
      accept: normalized ? "application/vnd.linkedin.normalized+json+2.1" : "application/json",
      "csrf-token": token,
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
    };

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

  function parseGraphqlExperienceItem(item, isGroupItem = false) {
    const entity = item?.components?.entityComponent;
    if (!entity?.titleV2?.text?.text) return null;
    const title = clean(entity.titleV2.text.text);
    const subtitle = clean(entity.subtitle?.text);
    const company = subtitle ? subtitle.split(" · ")[0] : "";
    const caption = clean(entity.caption?.text);
    return {
      role: title,
      company: isGroupItem ? "" : company,
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

  function findProfileUrnInPage() {
    const html = document.documentElement?.innerHTML ?? "";
    const match = html.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/)
      || html.match(/urn:li:fs_profile:([A-Za-z0-9_-]+)/);
    return match?.[1] ?? "";
  }

  async function fetchExperienceGraphql(urnId) {
    const id = clean(urnId);
    if (!id) return { role: "", company: "" };
    const profileUrn = encodeURIComponent(`urn:li:fsd_profile:${id}`);
    const variables = encodeURIComponent(`(profileUrn:${profileUrn},sectionType:experience)`);
    const data = await voyagerGet(
      `/graphql?variables=${variables}&queryId=${EXPERIENCE_QUERY_ID}&includeWebMetadata=true`,
      true,
    );
    return parseExperienceGraphql(data);
  }

  window.aftermeetFetchLinkedInVoyager = async function aftermeetFetchLinkedInVoyager(publicId) {
    const id = clean(publicId);
    if (!id) return null;

    const [profileView, contactInfo] = await Promise.all([
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileView`),
      voyagerGet(`/identity/profiles/${encodeURIComponent(id)}/profileContactInfo`),
    ]);

    const parsed = {
      ...parseProfileView(profileView),
      ...parseContactInfo(contactInfo),
    };

    if (!parsed.role || !parsed.company) {
      const urnId = parsed.urnId || findProfileUrnInPage();
      const experience = await fetchExperienceGraphql(urnId);
      if (experience.role) parsed.role = parsed.role || experience.role;
      if (experience.company) parsed.company = parsed.company || experience.company;
    }

    if (!parsed.firstName && !parsed.role && !parsed.email) return null;
    return parsed;
  };

  window.aftermeetLinkedInPublicId = parsePublicId;
})();
