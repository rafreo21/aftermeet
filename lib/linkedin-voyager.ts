/**
 * LinkedIn Voyager API response parsing.
 * Inspired by open-linkedin-api: https://github.com/EseToni/open-linkedin-api
 *
 * Endpoints (authenticated, same-origin):
 * - GET /voyager/api/identity/profiles/{publicId}/profileView
 * - GET /voyager/api/identity/profiles/{publicId}/profileContactInfo
 */

export type LinkedInVoyagerProfile = {
  firstName: string;
  lastName: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  companyWebsite: string;
  personalWebsite: string;
  publicId: string;
};

export function parseLinkedInPublicId(url: string) {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1]?.replace(/\/+$/, "") ?? "";
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isCurrentPosition(item: Record<string, unknown>) {
  const timePeriod = item.timePeriod as { endDate?: { year?: number } | null } | undefined;
  if (!timePeriod?.endDate) return true;
  const year = timePeriod.endDate.year;
  return year === undefined || year === 0;
}

function companyFromPosition(item: Record<string, unknown>) {
  const direct = clean(item.companyName);
  if (direct) return direct;
  const company = item.company as Record<string, unknown> | undefined;
  const miniCompany = company?.miniCompany as Record<string, unknown> | undefined;
  return clean(miniCompany?.name) || clean(company?.name);
}

export function parseProfileViewResponse(data: Record<string, unknown> | null | undefined): Partial<LinkedInVoyagerProfile> {
  if (!data || (typeof data.status === "number" && data.status !== 200)) return {};

  const profile = data.profile as Record<string, unknown> | undefined;
  if (!profile) return {};

  const miniProfile = profile.miniProfile as Record<string, unknown> | undefined;
  const firstName = clean(profile.firstName) || clean(miniProfile?.firstName);
  const lastName = clean(profile.lastName) || clean(miniProfile?.lastName);
  const publicId = clean(miniProfile?.publicIdentifier);

  const positionView = data.positionView as { elements?: Record<string, unknown>[] } | undefined;
  const current = (positionView?.elements ?? []).find((item) => isCurrentPosition(item))
    ?? positionView?.elements?.[0];

  return {
    firstName,
    lastName,
    publicId,
    role: clean(current?.title),
    company: current ? companyFromPosition(current) : "",
  };
}

function websiteUrl(item: Record<string, unknown>) {
  return clean(item.url);
}

function websiteLabel(item: Record<string, unknown>) {
  const type = item.type as Record<string, unknown> | undefined;
  if (!type) return "";
  const standard = type["com.linkedin.voyager.identity.profile.StandardWebsite"] as Record<string, unknown> | undefined;
  if (standard?.category) return clean(standard.category);
  const custom = type["com.linkedin.voyager.identity.profile.CustomWebsite"] as Record<string, unknown> | undefined;
  if (custom?.label) return clean(custom.label);
  return "";
}

export function parseContactInfoResponse(data: Record<string, unknown> | null | undefined): Partial<LinkedInVoyagerProfile> {
  if (!data) return {};

  const phoneNumbers = data.phoneNumbers as Array<{ number?: string }> | undefined;
  const phone = clean(phoneNumbers?.[0]?.number);

  let companyWebsite = "";
  let personalWebsite = "";
  for (const item of (data.websites as Record<string, unknown>[] | undefined) ?? []) {
    const url = websiteUrl(item);
    if (!url) continue;
    const label = websiteLabel(item).toLowerCase();
    if (!personalWebsite && /portfolio|personal|blog|other|website/.test(label)) personalWebsite = url;
    if (!companyWebsite && /company|employer|organization/.test(label)) companyWebsite = url;
    if (!personalWebsite && !companyWebsite) personalWebsite = url;
  }

  return {
    email: clean(data.emailAddress).toLowerCase(),
    phone,
    companyWebsite,
    personalWebsite,
  };
}

export function mergeVoyagerIntoProfile<T extends Record<string, string | undefined>>(
  base: T,
  voyager: Partial<LinkedInVoyagerProfile>,
): T {
  const merged = { ...base };
  (["firstName", "lastName", "role", "company", "email", "phone", "companyWebsite", "personalWebsite"] as const).forEach((field) => {
    const value = clean(voyager[field]);
    if (value) merged[field] = value;
  });
  return merged;
}

export const PROFILE_VIEW_FIXTURE = {
  profile: {
    firstName: "Raphael",
    lastName: "Okojie",
    miniProfile: {
      firstName: "Raphael",
      lastName: "Okojie",
      publicIdentifier: "rafreo",
    },
  },
  positionView: {
    elements: [
      {
        title: "Product Designer",
        companyName: "Nexleaf Analytics",
        timePeriod: {
          startDate: { year: 2025, month: 1 },
          endDate: null,
        },
      },
      {
        title: "Senior Product Designer",
        companyName: "Andela",
        timePeriod: {
          startDate: { year: 2022, month: 10 },
          endDate: { year: 2025, month: 5 },
        },
      },
    ],
  },
} as const;

export const CONTACT_INFO_FIXTURE = {
  emailAddress: "rafreo21@gmail.com",
  phoneNumbers: [{ number: "+447473177720", type: "MOBILE" }],
  websites: [],
} as const;
