/**
 * LinkedIn Voyager API response parsing.
 * Inspired by open-linkedin-api: https://github.com/EseToni/open-linkedin-api
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
  urnId: string;
};

export function parseLinkedInPublicId(url: string) {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1]?.replace(/\/+$/, "") ?? "";
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function urnIdFromEntityUrn(urn: unknown) {
  const value = clean(urn);
  if (!value) return "";
  return value.split(":").pop() ?? "";
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
  const urnId = urnIdFromEntityUrn(profile.entityUrn || miniProfile?.entityUrn);

  const positionView = data.positionView as { elements?: Record<string, unknown>[] } | undefined;
  const current = (positionView?.elements ?? []).find((item) => isCurrentPosition(item))
    ?? positionView?.elements?.[0];

  return {
    firstName,
    lastName,
    publicId,
    urnId,
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

function parseGraphqlExperienceItem(item: Record<string, unknown>, isGroupItem = false) {
  const component = item.components as { entityComponent?: Record<string, unknown> } | undefined;
  const entity = component?.entityComponent;
  if (!entity) return null;

  const title = clean((entity.titleV2 as { text?: { text?: string } } | undefined)?.text?.text);
  if (!title) return null;

  const subtitle = clean((entity.subtitle as { text?: string } | undefined)?.text);
  const company = subtitle ? subtitle.split(" · ")[0]?.trim() ?? "" : "";
  const caption = clean((entity.caption as { text?: string } | undefined)?.text);
  const employmentType = subtitle.includes(" · ") ? subtitle.split(" · ").slice(1).join(" · ").trim() : "";

  return {
    role: title,
    company: isGroupItem ? "" : company,
    employmentType: isGroupItem ? company : employmentType,
    isCurrent: /present/i.test(caption) || !caption.includes("-"),
  };
}

export function parseExperienceGraphqlResponse(data: Record<string, unknown> | null | undefined) {
  const included = (data?.included as Record<string, unknown>[] | undefined) ?? [];
  const parsedItems: Array<{ role: string; company: string; isCurrent: boolean }> = [];

  for (const block of included) {
    const elements = (block.components as { elements?: Record<string, unknown>[] } | undefined)?.elements ?? [];
    for (const item of elements) {
      const parsed = parseGraphqlExperienceItem(item);
      if (!parsed) continue;
      parsedItems.push({
        role: parsed.role,
        company: parsed.company || parsed.employmentType,
        isCurrent: parsed.isCurrent,
      });
    }
  }

  const current = parsedItems.find((item) => item.isCurrent) ?? parsedItems[0];
  if (!current) return { role: "", company: "" };
  return { role: current.role, company: current.company };
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
    entityUrn: "urn:li:fs_profile:ACoAAB123",
    miniProfile: {
      firstName: "Raphael",
      lastName: "Okojie",
      publicIdentifier: "rafreo",
      entityUrn: "urn:li:fs_miniProfile:ACoAAB123",
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

export const EXPERIENCE_GRAPHQL_FIXTURE = {
  included: [
    {
      components: {
        elements: [
          {
            components: {
              entityComponent: {
                titleV2: { text: { text: "Product Designer" } },
                subtitle: { text: "Nexleaf Analytics · Full-time" },
                caption: { text: "Jan 2025 - Present · 1 yr 7 mos" },
              },
            },
          },
        ],
      },
    },
  ],
} as const;
