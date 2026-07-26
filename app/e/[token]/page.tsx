"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { encounterFromSharedPayload, readEncounters, type Encounter } from "../../../lib/encounters";
import { buildAuthHref } from "../../../lib/auth/visitor-intent";
import { LinkButton } from "../../components/Button";
import { BrandMark } from "../../components/BrandMark";
import "../../app/product.css";
import "../../app/flow.css";

export default function GuestEncounterPage() {
  const [encounter, setEncounter] = useState<Encounter | null | undefined>(undefined);

  useEffect(() => {
    const token = window.location.pathname.split("/").filter(Boolean).at(-1) || "";
    void fetch(`/api/encounters/share/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (response.ok) {
          const payload = await response.json() as { encounter?: Record<string, unknown> };
          if (payload.encounter) {
            setEncounter(encounterFromSharedPayload(payload.encounter) ?? null);
            return;
          }
        }
        setEncounter(
          readEncounters().find((item) => item.shareToken === token && item.status === "shared") ?? null,
        );
      })
      .catch(() => {
        setEncounter(
          readEncounters().find((item) => item.shareToken === token && item.status === "shared") ?? null,
        );
      });
  }, []);

  if (encounter === undefined) return null;
  if (!encounter) return <main className="guest-page"><section className="guest-panel"><LockKeyIcon size={32} weight="bold" /><h1>This meeting record is not available.</h1><p>Ask the person who shared it to approve the record or send a new secure link.</p></section></main>;

  const guestActions = encounter.actions.filter((action) => action.owner === "guest");
  return (
    <main className="guest-page">
      <section className="guest-panel">
        <a className="guest-brand" href="/"><BrandMark size={36} />AfterMeet</a>
        <span className="step-pill">Shared with you</span>
        <h1>{encounter.title}</h1>
        <p className="guest-meta">A reviewed meeting record from {encounter.personName ? `your conversation with ${encounter.personName}` : "a recent conversation"}.</p>
        <article className="guest-summary"><span>What you agreed</span><p>{encounter.sharedSummary || "The shared summary is still being prepared."}</p></article>
        <section className="guest-actions">
          <h2>Your next steps</h2>
          {guestActions.length ? guestActions.map((action) => <article key={action.id}><CheckCircleIcon size={24} /><div><strong>{action.title}</strong><small>{action.dueAt ? `Due ${action.dueAt}` : "No due date"} · {action.channel}</small></div></article>) : <p>No actions have been assigned to you.</p>}
        </section>
        <div className="guest-claim">
          <div><strong>Keep this relationship moving</strong><p>Create your private AfterMeet workspace to claim these actions, receive reminders, and add your own notes.</p></div>
          <LinkButton href={buildAuthHref({ intent: "visitor", shareToken: encounter.shareToken })}>Create account <ArrowRightIcon size={16} weight="bold" /></LinkButton>
        </div>
        <small className="guest-privacy"><LockKeyIcon size={14} weight="bold" />The raw recording, transcript, and private notes were not shared with you.</small>
      </section>
    </main>
  );
}
