import type { Contact } from "./contacts";
import type { Campaign } from "./campaigns";
import type { Encounter } from "./encounters";

export type CampaignAttribution = {
  campaignId: string;
  contacts: number;
  captures: number;
  openFollowUps: number;
  completedFollowUps: number;
  followThroughRate: number;
  sources: Record<string, number>;
};

export type WorkspaceAnalytics = {
  totals: {
    contacts: number;
    captures: number;
    openFollowUps: number;
    completedFollowUps: number;
    followThroughRate: number;
  };
  campaigns: CampaignAttribution[];
  unattributed: CampaignAttribution;
};

function followUpCounts(encounters: Encounter[]) {
  const openFollowUps = encounters.flatMap((encounter) =>
    encounter.actions.filter((action) => action.owner === "me" && action.status !== "completed"),
  ).length;
  const completedFollowUps = encounters.flatMap((encounter) =>
    encounter.actions.filter((action) => action.owner === "me" && action.status === "completed"),
  ).length;
  const total = openFollowUps + completedFollowUps;
  return {
    openFollowUps,
    completedFollowUps,
    followThroughRate: total ? Math.round((completedFollowUps / total) * 100) : 0,
  };
}

function sourceBreakdown(contacts: Contact[]) {
  return contacts.reduce<Record<string, number>>((counts, contact) => {
    const key = contact.source || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function contactsForCampaign(campaignId: string, contacts: Contact[]) {
  return contacts.filter((contact) => contact.campaignId === campaignId);
}

export function encountersForCampaign(
  campaignId: string,
  contacts: Contact[],
  encounters: Encounter[],
) {
  const contactIds = new Set(contactsForCampaign(campaignId, contacts).map((contact) => contact.id));
  return encounters.filter((encounter) =>
    encounter.campaignId === campaignId ||
    (encounter.contactId ? contactIds.has(encounter.contactId) : false),
  );
}

export function buildCampaignAttribution(
  campaignId: string,
  contacts: Contact[],
  encounters: Encounter[],
): CampaignAttribution {
  const campaignContacts = contactsForCampaign(campaignId, contacts);
  const campaignEncounters = encountersForCampaign(campaignId, contacts, encounters);
  const followUps = followUpCounts(campaignEncounters);

  return {
    campaignId,
    contacts: campaignContacts.length,
    captures: campaignEncounters.length,
    ...followUps,
    sources: sourceBreakdown(campaignContacts),
  };
}

export function buildWorkspaceAnalytics(
  campaigns: Campaign[],
  contacts: Contact[],
  encounters: Encounter[],
): WorkspaceAnalytics {
  const campaignRows = campaigns.map((campaign) =>
    buildCampaignAttribution(campaign.id, contacts, encounters),
  );

  const attributedContactIds = new Set(
    contacts.filter((contact) => contact.campaignId).map((contact) => contact.id),
  );
  const unattributedContacts = contacts.filter((contact) => !contact.campaignId);
  const unattributedEncounters = encounters.filter((encounter) =>
    !encounter.campaignId && (!encounter.contactId || !attributedContactIds.has(encounter.contactId)),
  );
  const unattributedFollowUps = followUpCounts(unattributedEncounters);

  const allFollowUps = followUpCounts(encounters);

  return {
    totals: {
      contacts: contacts.length,
      captures: encounters.length,
      ...allFollowUps,
    },
    campaigns: campaignRows,
    unattributed: {
      campaignId: "",
      contacts: unattributedContacts.length,
      captures: unattributedEncounters.length,
      ...unattributedFollowUps,
      sources: sourceBreakdown(unattributedContacts),
    },
  };
}

export function formatSourceLabel(source: string) {
  switch (source) {
    case "exchange": return "Card exchange";
    case "badge": return "Badge scan";
    case "scan": return "QR scan";
    case "linkedin": return "LinkedIn";
    case "vcard": return "vCard";
    case "csv": return "CSV import";
    case "manual": return "Manual add";
    default: return "Unknown";
  }
}
