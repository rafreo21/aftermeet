"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../components/AppShell";
import { LinkButton } from "../components/Button";

type FollowUpNudge = { openCount: number; completedCount: number; completionRate: number };
export default function HomeDashboard() {
  const [nudge, setNudge] = useState<FollowUpNudge>({ openCount: 0, completedCount: 0, completionRate: 0 });

  function loadDashboard() {
    return fetch("/api/follow-ups", { cache: "no-store" }).then(async (followUpsResponse) => {
      if (followUpsResponse.ok) {
        const payload = await followUpsResponse.json() as { followUps?: Array<{ status?: string }> };
        const items = payload.followUps ?? [];
        const completedCount = items.filter((item) => item.status === "completed").length;
        const openCount = items.filter((item) => item.status !== "completed").length;
        const completionRate = items.length ? Math.round((completedCount / items.length) * 100) : 0;
        setNudge({ openCount, completedCount, completionRate });
      }
    }).catch(() => undefined);
  }

  useEffect(() => {
    void loadDashboard();
    function refreshWhenVisible() {
      if (document.visibilityState !== "hidden") void loadDashboard();
    }
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <AppShell
      active="home"
      title="Home"
      subtitle="Share your card. Capture the meeting. Follow up after."
      actions={<LinkButton size="small" href="/app/encounters/new"><MicrophoneIcon size={16} weight="fill" />Capture</LinkButton>}
    >
      <div className="flow-page">
        <section className="dashboard-hero">
          <div>
            <span className="step-pill">Consumer</span>
            <h1>Share your card in seconds</h1>
            <p>Same loop as mobile: show QR first, capture what mattered, then finish the follow-up.</p>
          </div>
          <div className="dashboard-score">
            <strong>{nudge.completedCount}</strong>
            <span>follow-ups completed</span>
            <small>{nudge.completedCount ? `${nudge.completionRate}% completion rate · ${nudge.openCount} still open` : nudge.openCount ? `${nudge.openCount} ready to complete` : "Complete your first follow-up."}</small>
            <LinkButton size="small" variant="secondary" href="/app/followups/new"><PlusIcon size={15} weight="bold" />Add follow-up</LinkButton>
          </div>
        </section>

        <section className="journey-panel">
          <header>
            <div>
              <span>Core journey</span>
              <h2>From introduction to action.</h2>
            </div>
            <small>Matches mobile</small>
          </header>
          <div className="journey-grid">
            {[
              ["01", QrCodeIcon, "Show my QR", "Open your card and share instantly.", "/app/cards#share"],
              ["02", MicrophoneIcon, "Capture context", "Record with consent while the meeting is fresh.", "/app/encounters/new"],
              ["03", UsersThreeIcon, "Connections", "People who shared with you and cards you saved.", "/app/people"],
              ["04", PaperPlaneTiltIcon, "Follow-ups", "Finish the next promised action.", "/app/followups"],
            ].map(([number, Icon, title, text, href]) => (
              <Link className="journey-step" href={String(href)} key={String(number)} prefetch={false}>
                <span>{String(number)}</span>
                <Icon size={23} weight="bold" />
                <div><h3>{String(title)}</h3><p>{String(text)}</p></div>
                <ArrowRightIcon size={17} weight="bold" />
              </Link>
            ))}
          </div>
        </section>

        <div className="dashboard-grid">
          <article className="dashboard-card dashboard-card-primary">
            <span>01 · Share</span>
            <IdentificationCardIcon size={30} weight="bold" />
            <h2>Ready to share</h2>
            <p>Your card, QR, wallet, and NFC tools live here — the same share surface as mobile.</p>
            <LinkButton href="/app/cards#share">Show my QR <ArrowRightIcon size={16} weight="bold" /></LinkButton>
          </article>
          <article className="dashboard-card">
            <span>02 · Capture</span>
            <MicrophoneIcon size={30} weight="fill" />
            <h2>Start an encounter</h2>
            <p>Record with consent, keep private notes, and review every shared next step.</p>
            <LinkButton variant="secondary" href="/app/encounters/new">Start capture <ArrowRightIcon size={16} weight="bold" /></LinkButton>
          </article>
          <article className="dashboard-card">
            <span>03 · Connections</span>
            <UsersThreeIcon size={30} weight="bold" />
            <h2>People you’ve met</h2>
            <p>Exchanges and saved cards — not the business CRM directory.</p>
            <LinkButton variant="secondary" href="/app/people">Open connections <ArrowRightIcon size={16} weight="bold" /></LinkButton>
          </article>
        </div>
      </div>
    </AppShell>
  );
}
