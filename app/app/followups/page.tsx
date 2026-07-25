"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { AppShell } from "../../components/AppShell";
import { Button, LinkButton } from "../../components/Button";
import "../product.css";
import "../flow.css";

type Contact = { firstName: string; lastName: string; company: string; context: string; nextAction: string };

export default function FollowupsPage() {
  const [contact, setContact] = useState<Contact | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => { try { const value = localStorage.getItem("aftermeet-last-contact-v1"); if (value) setContact(JSON.parse(value)); } catch {} }, []);

  return (
    <AppShell active="followups" title="Follow-ups" subtitle="Turn meeting context into a clear, reviewed next step.">
      <div className="flow-page">
        <div className="flow-heading"><div><h1>Keep the promise.</h1><p>AfterMeet prioritises completed follow-up—not drafts generated and forgotten.</p></div></div>
        {contact ? <div className="follow-list"><article className="follow-card"><div><span className="step-pill">{done ? "Completed" : "Ready to review"}</span><h2>{contact.firstName} {contact.lastName}{contact.company ? ` · ${contact.company}` : ""}</h2><p>{contact.nextAction || "Send a thoughtful follow-up based on the meeting context."}</p>{contact.context && <p><strong>Context:</strong> {contact.context}</p>}</div>{done ? <CheckCircleIcon size={42} weight="fill" /> : <Button onClick={() => setDone(true)}><PaperPlaneTiltIcon size={18} weight="bold" />Mark follow-up complete</Button>}</article><LinkButton variant="secondary" href="/app/contacts">Back to contacts</LinkButton></div> : <div className="empty-state"><div><span className="empty-icon"><PaperPlaneTiltIcon size={32} weight="bold" /></span><h2>No follow-ups yet</h2><p>Add someone you met and capture a next action to create your first follow-up.</p><LinkButton href="/app/contacts/new">Add a contact</LinkButton></div></div>}
      </div>
    </AppShell>
  );
}
