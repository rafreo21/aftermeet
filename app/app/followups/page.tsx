"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { AppShell } from "../../components/AppShell";
import { ActionDoButton } from "../../components/ActionDoButton";
import { PageSkeleton, StatusMessage } from "../../components/AsyncState";
import { Button, LinkButton } from "../../components/Button";
import { buildActionLinkContext, channelLabel } from "../../../lib/action-links";
import { findContactById } from "../../../lib/contacts";
import { readEncounters, updateEncounter, type Encounter } from "../../../lib/encounters";
import { recordCompletedAction, supportsOutboundDraft } from "../../../lib/outbound-habit";
import { OutboundDraftPanel } from "../../components/OutboundDraftPanel";
import "../product.css";
import "../flow.css";

type Contact = { firstName: string; lastName: string; company: string; context: string; nextAction: string };

export default function FollowupsPage() {
  const [contact, setContact] = useState<Contact | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [done, setDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try { const value = localStorage.getItem("aftermeet-last-contact-v1"); if (value) setContact(JSON.parse(value)); } catch {}
    setEncounters(readEncounters());
    setHydrated(true);
  }, []);
  const openActions = useMemo(() => encounters.flatMap((encounter) => encounter.actions.filter((action) => action.owner === "me" && action.status !== "completed").map((action) => ({ encounter, action }))), [encounters]);

  function completeAction(encounterId: string, actionId: string) {
    updateEncounter(encounterId, (encounter) => ({ ...encounter, actions: encounter.actions.map((action) => action.id === actionId ? { ...action, status: "completed" } : action) }));
    recordCompletedAction();
    setEncounters(readEncounters());
    setMessage("Follow-up completed and moved out of your active Inbox.");
  }

  function saveAction(encounterId: string, actionId: string, nextAction: Encounter["actions"][number]) {
    updateEncounter(encounterId, (encounter) => ({
      ...encounter,
      actions: encounter.actions.map((action) => action.id === actionId ? nextAction : action),
    }));
    setEncounters(readEncounters());
  }

  return (
    <AppShell active="followups" title="Inbox" subtitle="Reviewed actions and reminders that need your attention.">
      <div className="flow-page">
        <div className="flow-heading"><div><h1>Keep the promise.</h1><p>Nothing is sent automatically. Review the context, take the action, then mark it complete.</p></div><div className="flow-heading-actions"><LinkButton variant="secondary" href="/app/outbound"><PaperPlaneTiltIcon size={17} weight="bold" />Outbound queue</LinkButton><LinkButton href="/app/encounters/new"><MicrophoneIcon size={17} weight="fill" />Capture encounter</LinkButton></div></div>
        {message && <StatusMessage tone="success" action={<Button size="small" variant="ghost" onClick={() => setMessage("")}>Dismiss</Button>}>{message}</StatusMessage>}
        {!hydrated ? <PageSkeleton rows={3} /> : openActions.length ? <div className="inbox-list">{openActions.map(({ encounter, action }) => {
  const context = buildActionLinkContext(
    encounter,
    encounter.contactId ? findContactById(encounter.contactId) : null,
  );
          return (
            <article className="inbox-item-stack" key={action.id}>
              <div className="inbox-item">
                <span className="inbox-channel">{channelLabel(action.channel)}</span>
                <div>
                  <h2>{action.title}</h2>
                  <p>{encounter.personName || encounter.title}</p>
                  <small><ClockIcon size={14} weight="bold" />{action.dueAt ? `Due ${action.dueAt}` : "No due date"}</small>
                </div>
                <div className="inbox-actions">
                  <ActionDoButton action={action} context={context} showSecondary />
                  <LinkButton size="small" variant="secondary" href={`/app/encounters/${encounter.id}`}>Review context</LinkButton>
                  <Button size="small" onClick={() => completeAction(encounter.id, action.id)}><CheckCircleIcon size={16} weight="bold" />Complete</Button>
                </div>
              </div>
              {supportsOutboundDraft(action.channel) ? (
                <OutboundDraftPanel
                  compact
                  encounter={encounter}
                  action={action}
                  context={context}
                  contact={encounter.contactId ? findContactById(encounter.contactId) : null}
                  onActionChange={(next) => saveAction(encounter.id, action.id, next)}
                />
              ) : null}
            </article>
          );
        })}</div> : contact ? <div className="follow-list"><article className="follow-card"><div><span className="step-pill">{done ? "Completed" : "Legacy follow-up"}</span><h2>{contact.firstName} {contact.lastName}{contact.company ? ` · ${contact.company}` : ""}</h2><p>{contact.nextAction || "Send a thoughtful follow-up based on the meeting context."}</p>{contact.context && <p><strong>Context:</strong> {contact.context}</p>}</div>{done ? <CheckCircleIcon size={42} weight="fill" /> : <Button onClick={() => { setDone(true); setMessage("Follow-up marked complete."); }}><PaperPlaneTiltIcon size={18} weight="bold" />Mark complete</Button>}</article></div> : <div className="empty-state"><div><span className="empty-icon"><PaperPlaneTiltIcon size={32} weight="bold" /></span><h2>Your Inbox is clear</h2><p>Capture a conversation and assign a reviewed next action. It will appear here as a reminder.</p><LinkButton href="/app/encounters/new">Capture first encounter</LinkButton></div></div>}
      </div>
    </AppShell>
  );
}
