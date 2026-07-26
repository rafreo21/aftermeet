"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { AppShell } from "../../../components/AppShell";
import { LinkButton } from "../../../components/Button";
import { buildWorkspaceAnalytics, formatSourceLabel } from "../../../../lib/campaign-analytics";
import { campaignDateLabel, readCampaigns, type Campaign } from "../../../../lib/campaigns";
import { readContacts } from "../../../../lib/contacts";
import { readEncounters } from "../../../../lib/encounters";
import "../../product.css";
import "../../flow.css";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    setCampaigns(readCampaigns());
  }, []);

  const analytics = useMemo(
    () => buildWorkspaceAnalytics(campaigns, readContacts(), readEncounters()),
    [campaigns],
  );

  return (
    <AppShell
      active="activate"
      title="Campaigns"
      subtitle="Tag event and outreach work, then see what converted into captures and follow-through."
      actions={
        <>
          <LinkButton size="small" variant="ghost" href="/app/activate"><ArrowLeftIcon size={16} />Activate</LinkButton>
          <LinkButton size="small" href="/app/activate/campaigns/new"><PlusIcon size={16} weight="bold" />New campaign</LinkButton>
        </>
      }
    >
      <div className="flow-page activate-page">
        <section className="activate-metrics">
          <article><strong>{analytics.totals.contacts}</strong><span>Total contacts</span></article>
          <article><strong>{analytics.totals.captures}</strong><span>Total captures</span></article>
          <article><strong>{analytics.totals.followThroughRate}%</strong><span>Follow-through</span></article>
          <article><strong>{campaigns.filter((campaign) => campaign.status === "active").length}</strong><span>Active campaigns</span></article>
        </section>

        {campaigns.length ? (
          <div className="campaign-list">
            {campaigns.map((campaign) => {
              const row = analytics.campaigns.find((item) => item.campaignId === campaign.id);
              return (
                <LinkButton key={campaign.id} variant="secondary" href={`/app/activate/campaigns/${campaign.id}`} className="campaign-row">
                  <div>
                    <strong>{campaign.name}</strong>
                    <small>{[campaign.location, campaignDateLabel(campaign), campaign.status].filter(Boolean).join(" · ")}</small>
                  </div>
                  <div className="campaign-row-metrics">
                    <span>{row?.contacts ?? 0} people</span>
                    <span>{row?.captures ?? 0} captures</span>
                    <span>{row?.followThroughRate ?? 0}% follow-through</span>
                  </div>
                </LinkButton>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <h2>No campaigns yet</h2>
              <p>Create one for a conference, dinner series, or partner push, then tag captures as you go.</p>
              <LinkButton href="/app/activate/campaigns/new"><PlusIcon size={17} weight="bold" />Create campaign</LinkButton>
            </div>
          </div>
        )}

        {analytics.unattributed.contacts || analytics.unattributed.captures ? (
          <section className="activate-panel muted">
            <header>
              <span className="step-pill">Unattributed</span>
              <h2>Outside campaigns</h2>
              <p>{analytics.unattributed.contacts} contacts and {analytics.unattributed.captures} captures are not linked to a campaign yet.</p>
            </header>
            {Object.keys(analytics.unattributed.sources).length ? (
              <div className="source-breakdown">
                {Object.entries(analytics.unattributed.sources).map(([source, count]) => (
                  <span key={source}>{formatSourceLabel(source)} · {count}</span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
