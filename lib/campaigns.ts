export type CampaignStatus = "active" | "archived";

export type Campaign = {
  id: string;
  name: string;
  location: string;
  startsAt: string;
  endsAt: string;
  notes: string;
  status: CampaignStatus;
  createdAt: string;
};

export const CAMPAIGNS_STORAGE_KEY = "aftermeet-campaigns-v1";
export const ACTIVE_CAMPAIGN_STORAGE_KEY = "aftermeet-active-campaign-v1";

export function readCampaigns(): Campaign[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CAMPAIGNS_STORAGE_KEY) || "[]") as Campaign[];
  } catch {
    return [];
  }
}

export function writeCampaigns(campaigns: Campaign[]) {
  localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
}

export function findCampaignById(campaignId: string) {
  return readCampaigns().find((campaign) => campaign.id === campaignId) ?? null;
}

export function upsertCampaign(campaign: Campaign) {
  writeCampaigns([campaign, ...readCampaigns().filter((item) => item.id !== campaign.id)]);
}

export function createCampaign(seed: Pick<Campaign, "name"> & Partial<Omit<Campaign, "id" | "name" | "createdAt" | "status">>) {
  const campaign: Campaign = {
    id: crypto.randomUUID(),
    name: seed.name.trim(),
    location: seed.location?.trim() ?? "",
    startsAt: seed.startsAt ?? "",
    endsAt: seed.endsAt ?? "",
    notes: seed.notes?.trim() ?? "",
    status: "active",
    createdAt: new Date().toISOString(),
  };
  upsertCampaign(campaign);
  return campaign;
}

export function archiveCampaign(campaignId: string) {
  const campaign = findCampaignById(campaignId);
  if (!campaign) return null;
  const archived = { ...campaign, status: "archived" as const };
  upsertCampaign(archived);
  if (readActiveCampaignId() === campaignId) writeActiveCampaignId("");
  return archived;
}

export function readActiveCampaignId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_CAMPAIGN_STORAGE_KEY) || "";
}

export function writeActiveCampaignId(campaignId: string) {
  localStorage.setItem(ACTIVE_CAMPAIGN_STORAGE_KEY, campaignId);
}

export function readActiveCampaign() {
  const id = readActiveCampaignId();
  return id ? findCampaignById(id) : null;
}

export function campaignDateLabel(campaign: Campaign) {
  if (campaign.startsAt && campaign.endsAt) {
    return `${campaign.startsAt} – ${campaign.endsAt}`;
  }
  if (campaign.startsAt) return `From ${campaign.startsAt}`;
  if (campaign.endsAt) return `Until ${campaign.endsAt}`;
  return "";
}
