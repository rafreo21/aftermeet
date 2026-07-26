"use client";

import { SelectField } from "./FormField";
import { readActiveCampaignId, readCampaigns, type Campaign } from "../../lib/campaigns";

type ActiveCampaignFieldProps = {
  value: string;
  onChange: (campaignId: string) => void;
  label?: string;
  hint?: string;
};

export function ActiveCampaignField({
  value,
  onChange,
  label = "Campaign",
  hint = "Attribute this person to an event or outreach campaign.",
}: ActiveCampaignFieldProps) {
  const campaigns = readCampaigns().filter((campaign) => campaign.status === "active");
  if (!campaigns.length) return null;

  return (
    <SelectField
      label={label}
      hint={hint}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">No campaign</option>
      {campaigns.map((campaign: Campaign) => (
        <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
      ))}
    </SelectField>
  );
}

export function defaultCampaignId() {
  return readActiveCampaignId();
}
