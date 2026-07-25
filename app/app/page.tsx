"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../components/AppShell";
import { LinkButton } from "../components/Button";
import "./product.css";
import "./flow.css";

type Contact = { firstName: string; lastName: string; company: string; nextAction?: string };

export default function HomeDashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    try { setContacts(JSON.parse(localStorage.getItem("aftermeet-contacts-v1") || "[]")); } catch {}
  }, []);
  const latest = contacts[0];

  return (
    <AppShell
      active="home"
      title="Home"
      subtitle="Your relationship workspace"
      actions={<LinkButton size="small" href="/app/contacts/new"><PlusIcon size={16} weight="bold" />Add contact</LinkButton>}
    >
      <div className="flow-page">
        <section className="dashboard-hero">
          <div><span className="step-pill"><b aria-hidden="true">👋</b> Welcome back</span><h1>What needs your attention today?</h1><p>Share your card, capture the meeting, and finish the follow-up while the conversation is still fresh.</p></div>
          <div className="dashboard-score"><strong>{contacts.length}</strong><span>people captured</span><small>{contacts.length ? "Your relationship workspace is growing." : "Add your first meeting to begin."}</small></div>
        </section>

        <section className="journey-panel">
          <header><div><span>Core journey</span><h2>From introduction to action.</h2></div><small>Four connected steps</small></header>
          <div className="journey-grid">
            {[
              ["01", IdentificationCardIcon, "Create your card", "Set your public identity.", "/app/cards"],
              ["02", QrCodeIcon, "Share and scan", "Open your card and QR together.", "/app/cards#share"],
              ["03", UsersThreeIcon, "Capture context", "Remember who you met and why.", "/app/contacts/new"],
              ["04", PaperPlaneTiltIcon, "Complete follow-up", "Finish the next promised action.", "/app/followups"],
            ].map(([number, Icon, title, text, href]) => (
              <a className="journey-step" href={String(href)} key={String(number)}>
                <span>{String(number)}</span><Icon size={23} weight="bold" /><div><h3>{String(title)}</h3><p>{String(text)}</p></div><ArrowRightIcon size={17} weight="bold" />
              </a>
            ))}
          </div>
        </section>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <span>My card</span><IdentificationCardIcon size={30} weight="bold" /><h2>Ready to share</h2><p>Your card and scannable QR now live in one focused workspace.</p><LinkButton variant="secondary" href="/app/cards">Open my card <ArrowRightIcon size={16} weight="bold" /></LinkButton>
          </article>
          <article className="dashboard-card">
            <span>Latest contact</span><UsersThreeIcon size={30} weight="bold" /><h2>{latest ? `${latest.firstName} ${latest.lastName}` : "No contacts yet"}</h2><p>{latest ? `${latest.company || "New connection"}${latest.nextAction ? ` · ${latest.nextAction}` : ""}` : "Capture the next person you meet and the context that matters."}</p><LinkButton variant="secondary" href={latest ? "/app/contacts" : "/app/contacts/new"}>{latest ? "View contacts" : "Add first contact"} <ArrowRightIcon size={16} weight="bold" /></LinkButton>
          </article>
        </div>
      </div>
    </AppShell>
  );
}
