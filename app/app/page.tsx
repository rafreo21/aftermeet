"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { ListChecksIcon } from "@phosphor-icons/react/dist/csr/ListChecks";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../components/AppShell";
import { LinkButton } from "../components/Button";

type FollowUpNudge = {
  openCount: number;
  urgentCount: number;
  completedCount: number;
  completionRate: number;
};

function isDueNow(dueAt: string) {
  if (!dueAt.trim()) return false;
  const due = new Date(`${dueAt.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() <= today.getTime();
}

export default function HomeDashboard() {
  const [nudge, setNudge] = useState<FollowUpNudge>({ openCount: 0, urgentCount: 0, completedCount: 0, completionRate: 0 });

  function loadDashboard() {
    return fetch("/api/follow-ups", { cache: "no-store" }).then(async (followUpsResponse) => {
      if (followUpsResponse.ok) {
        const payload = await followUpsResponse.json() as {
          followUps?: Array<{ status?: string; owner?: string; dueAt?: string }>;
        };
        const items = payload.followUps ?? [];
        const completedCount = items.filter((item) => item.status === "completed").length;
        const openCount = items.filter((item) => item.status !== "completed").length;
        const urgentCount = items.filter((item) => (
          item.status !== "completed" && item.owner === "me" && isDueNow(item.dueAt ?? "")
        )).length;
        const completionRate = items.length ? Math.round((completedCount / items.length) * 100) : 0;
        setNudge({ openCount, urgentCount, completedCount, completionRate });
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
        </section>

        <Link className="home-followup-summary" href="/app/followups" prefetch={false}>
          <span className={nudge.urgentCount ? "attention" : ""}>
            <ListChecksIcon size={25} weight="bold" />
          </span>
          <div>
            <strong>{nudge.urgentCount
              ? `${nudge.urgentCount} follow-up${nudge.urgentCount === 1 ? "" : "s"} need you`
              : nudge.openCount
                ? `${nudge.openCount} follow-up${nudge.openCount === 1 ? "" : "s"} coming up`
                : nudge.completedCount
                  ? "You’re all caught up"
                  : "No follow-ups yet"}</strong>
            <small>{nudge.completedCount || nudge.openCount
              ? `${nudge.completedCount} completed · ${nudge.completionRate}% of ${nudge.completedCount + nudge.openCount} kept`
              : "Your commitments will appear here."}</small>
          </div>
          <ArrowRightIcon size={19} weight="bold" />
        </Link>

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
            <p>Your card, QR, wallet, and NFC tools live here, the same share surface as mobile.</p>
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
            <p>Exchanges and saved cards, not the business CRM directory.</p>
            <LinkButton variant="secondary" href="/app/people">Open connections <ArrowRightIcon size={16} weight="bold" /></LinkButton>
          </article>
        </div>
      </div>
    </AppShell>
  );
}
