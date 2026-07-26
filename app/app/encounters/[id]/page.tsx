"use client";

import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { AppShell } from "../../../components/AppShell";
import { Button, LinkButton } from "../../../components/Button";
import { TextAreaField, TextField } from "../../../components/FormField";
import { formatDuration, readEncounters, updateEncounter, writeEncounter, type Encounter, type EncounterAction } from "../../../../lib/encounters";
import "../../product.css";
import "../../flow.css";

export default function EncounterReviewPage() {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [encounterId, setEncounterId] = useState("");
  const [newAction, setNewAction] = useState({ title: "", owner: "me" as "me" | "guest", dueAt: "", channel: "other" as EncounterAction["channel"] });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = window.location.pathname.split("/").filter(Boolean).at(-1) || "";
    const draftValue = new URLSearchParams(window.location.search).get("draft");
    if (draftValue) {
      try {
        const draft = JSON.parse(draftValue) as Encounter;
        writeEncounter(draft);
        setEncounterId(draft.id);
        setEncounter(draft);
        window.history.replaceState({}, "", `/app/encounters/${draft.id}`);
        return;
      } catch {}
    }
    setEncounterId(id);
    setEncounter(readEncounters().find((item) => item.id === id) ?? null);
  }, []);

  function patch(updater: (current: Encounter) => Encounter) {
    const updated = updateEncounter(encounterId, updater);
    setEncounter(updated);
  }

  function addAction() {
    if (!newAction.title.trim()) return;
    patch((current) => ({
      ...current,
      actions: [...current.actions, { id: crypto.randomUUID(), title: newAction.title.trim(), owner: newAction.owner, dueAt: newAction.dueAt, channel: newAction.channel, status: "open" }],
    }));
    setNewAction({ title: "", owner: "me", dueAt: "", channel: "other" });
  }

  async function copyGuestLink() {
    if (!encounter) return;
    const url = `${window.location.origin}/e/${encounter.shareToken}`;
    await navigator.clipboard.writeText(url);
    setMessage("Guest link copied.");
  }

  function approveAndShare() {
    patch((current) => ({ ...current, status: "shared" }));
    setMessage("Shared view is ready. Nothing has been sent automatically.");
  }

  if (!encounter) {
    return <AppShell active="home" title="Encounter"><div className="empty-state"><div><h2>Encounter not found</h2><p>This local encounter may have been removed or created in another browser.</p><LinkButton href="/app">Back home</LinkButton></div></div></AppShell>;
  }

  return (
    <AppShell
      active="home"
      title="Review encounter"
      subtitle="Decide what stays private, what is shared, and who owns each next step."
      actions={<LinkButton size="small" variant="ghost" href="/app"><ArrowLeftIcon size={16} />Home</LinkButton>}
    >
      <div className="review-layout">
        <main className="review-main">
          <header className="review-heading">
            <div><span className="step-pill">{encounter.status === "shared" ? "Shared" : "Needs review"}</span><h1>{encounter.title}</h1><p>{encounter.personName || "Unlinked person"} · {formatDuration(encounter.durationSeconds)} · consent recorded by {encounter.consent.method}</p></div>
            {encounter.status === "shared" && <CheckCircleIcon size={42} weight="fill" />}
          </header>

          <section className="review-section private-section">
            <header><span><LockKeyIcon size={20} weight="bold" /></span><div><h2>Your private context</h2><p>This content is never visible in the guest view.</p></div></header>
            <TextAreaField label="Full transcript" hint="Private" rows={8} value={encounter.transcript} onChange={(event) => patch((current) => ({ ...current, transcript: event.target.value }))} />
            <TextAreaField label="Private notes" hint="Only you" rows={4} value={encounter.privateNotes} onChange={(event) => patch((current) => ({ ...current, privateNotes: event.target.value }))} />
          </section>

          <section className="review-section shared-section">
            <header><span><ShareNetworkIcon size={20} weight="bold" /></span><div><h2>Shared meeting record</h2><p>Only this approved summary and guest-assigned actions appear for the other person.</p></div></header>
            <TextAreaField label="Shared summary" hint="Participant can see this" rows={5} value={encounter.sharedSummary} onChange={(event) => patch((current) => ({ ...current, sharedSummary: event.target.value }))} />
          </section>

          <section className="review-section">
            <header><span><CheckCircleIcon size={20} weight="bold" /></span><div><h2>Next actions</h2><p>Assign each promise clearly. Every open action appears in the right person’s Inbox.</p></div></header>
            <div className="action-list">
              {encounter.actions.map((action) => (
                <article key={action.id}>
                  <button
                    className={action.status === "completed" ? "action-check complete" : "action-check"}
                    onClick={() => patch((current) => ({ ...current, actions: current.actions.map((item) => item.id === action.id ? { ...item, status: item.status === "completed" ? "open" : "completed" } : item) }))}
                    aria-label={action.status === "completed" ? "Mark open" : "Mark complete"}
                  ><CheckCircleIcon size={22} weight={action.status === "completed" ? "fill" : "regular"} /></button>
                  <div><strong>{action.title}</strong><small>{action.owner === "me" ? "You" : encounter.personName || "Guest"}{action.dueAt ? ` · due ${action.dueAt}` : ""} · {action.channel}</small></div>
                </article>
              ))}
              {!encounter.actions.length && <p className="muted-copy">No actions yet. Add the first commitment below.</p>}
            </div>
            <div className="new-action">
              <TextField label="Action" value={newAction.title} onChange={(event) => setNewAction((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Send the introduction" />
              <label className="compact-field"><span>Owner</span><select value={newAction.owner} onChange={(event) => setNewAction((current) => ({ ...current, owner: event.target.value as "me" | "guest" }))}><option value="me">Me</option><option value="guest">{encounter.personName || "Guest"}</option></select></label>
              <label className="compact-field"><span>Channel</span><select value={newAction.channel} onChange={(event) => setNewAction((current) => ({ ...current, channel: event.target.value as EncounterAction["channel"] }))}><option value="other">General</option><option value="email">Email</option><option value="linkedin">LinkedIn</option><option value="call">Call</option><option value="meeting">Meeting</option><option value="send">Send something</option></select></label>
              <TextField label="Due" type="date" value={newAction.dueAt} onChange={(event) => setNewAction((current) => ({ ...current, dueAt: event.target.value }))} />
              <Button size="small" onClick={addAction}><PlusIcon size={15} weight="bold" />Add</Button>
            </div>
          </section>
        </main>

        <aside className="share-rail">
          <span>Participant access</span>
          <h2>Keep both people aligned.</h2>
          <p>Approve the shared record, then send the secure link yourself. After signup, the participant can see their summary and assigned actions.</p>
          <div className="guest-card"><strong>{encounter.personName || "Guest participant"}</strong><small>{encounter.personEmail || "No email added"}</small></div>
          <Button fullWidth onClick={approveAndShare}><CheckCircleIcon size={18} weight="bold" />Approve shared record</Button>
          <Button fullWidth variant="secondary" onClick={copyGuestLink}><CopyIcon size={18} weight="bold" />Copy guest link</Button>
          {encounter.personEmail && <a className="email-invite" href={`mailto:${encodeURIComponent(encounter.personEmail)}?subject=${encodeURIComponent(`Your AfterMeet notes: ${encounter.title}`)}&body=${encodeURIComponent(`Here is the meeting record we agreed to share: ${typeof window !== "undefined" ? `${window.location.origin}/e/${encounter.shareToken}` : ""}`)}`}><EnvelopeSimpleIcon size={18} weight="bold" />Open email invite</a>}
          <small>AfterMeet never sends or approves a follow-up without you.</small>
          {message && <p className="share-message" role="status">{message}</p>}
        </aside>
      </div>
    </AppShell>
  );
}
