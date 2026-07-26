(function initAfterMeetLinkedInVoyager() {
  const API_BASE = "https://www.linkedin.com/voyager/api";

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

  async function voyagerGet(path) {
    const token = csrfToken();
    if (!token) return null;
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {
        accept: "application/vnd.linkedin.normalized+json+2.1",
        "csrf-token": token,
        "x-restli-protocol-version": "2.0.0",
        "x-li-lang": "en_US",
      },
    });
    if (!response.ok) return null;
    return response.json();
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

  function mergeVoyager(base, voyager) {
    const merged = { ...base };
    ["firstName", "lastName", "role", "company", "email", "phone", "companyWebsite", "personalWebsite"].forEach((field) => {
      const value = clean(voyager[field]);
      if (value) merged[field] = value;
    });
    return merged;
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

    if (!parsed.firstName && !parsed.role && !parsed.email) return null;
    return parsed;
  };

  window.aftermeetLinkedInPublicId = parsePublicId;
})();
