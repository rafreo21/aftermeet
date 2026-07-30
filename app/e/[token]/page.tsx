"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { encounterFromSharedPayload, readEncounters, type Encounter } from "../../../lib/encounters";
import { buildAuthHref } from "../../../lib/auth/visitor-intent";
import { CLOUD_RECORDING_RETENTION_DAYS, formatRecordingAvailableUntil } from "../../../lib/recording-metadata";
import { LinkButton } from "../../components/Button";
import { BrandMark } from "../../components/BrandMark";
import "../../app/product.css";
import "../../app/flow.css";

export default function GuestEncounterPage() {
  const [encounter, setEncounter] = useState<Encounter | null | undefined>(undefined);
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState("");

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

  async function commitFollowUp() {
    if (!encounter || followUpSubmitting) return;
    setFollowUpSubmitting(true);
    setFollowUpError("");
    try {
      const response = await fetch(`/api/encounters/share/${encodeURIComponent(encounter.shareToken)}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: followUpNote }),
      });
      const payload = await response.json() as { guestFollowUp?: Encounter["guestFollowUp"]; error?: string };
      if (!response.ok || !payload.guestFollowUp) {
        setFollowUpError(payload.error || "Could not record your follow-up. Try again.");
        return;
      }
      setEncounter({ ...encounter, guestFollowUp: payload.guestFollowUp });
    } catch {
      setFollowUpError("Could not record your follow-up. Check your connection and try again.");
    } finally {
      setFollowUpSubmitting(false);
    }
  }

  const guestActions = encounter.actions.filter((action) => action.owner === "guest");
  const sharedRecordingUrl = encounter.recording?.sharedAudioUrl
    ? (encounter.recording.sharedAudioUrl.startsWith("http")
      ? encounter.recording.sharedAudioUrl
      : `${window.location.origin}${encounter.recording.sharedAudioUrl}`)
    : null;
  const recordingAvailableUntil = formatRecordingAvailableUntil(encounter.recording?.cloudExpiresAt);

  return (
    <main className="guest-page">
      <section className="guest-panel">
        <a className="guest-brand" href="/"><BrandMark size={36} />AfterMeet</a>
        <span className="step-pill">Shared with you</span>
        <h1>{encounter.title}</h1>
        <p className="guest-meta">A reviewed meeting record from {encounter.personName ? `your conversation with ${encounter.personName}` : "a recent conversation"}.</p>
        {sharedRecordingUrl ? (
          <article className="guest-summary">
            <span>Meeting recording</span>
            <audio controls preload="metadata" src={sharedRecordingUrl} style={{ width: "100%", marginTop: 12 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, alignItems: "center" }}>
              <a className="button secondary small" href={sharedRecordingUrl} download={`${encounter.title.replace(/[^\w\- ]+/g, "").trim() || "aftermeet"}-recording.m4a`}>
                <DownloadSimpleIcon size={16} weight="bold" />
                Save to my device
              </a>
              {recordingAvailableUntil ? (
                <small style={{ color: "var(--muted)" }}>
                  Available online until {recordingAvailableUntil}. Download now to keep a copy after that.
                </small>
              ) : (
                <small style={{ color: "var(--muted)" }}>
                  Shared recordings stay online for {CLOUD_RECORDING_RETENTION_DAYS} days. Download to keep a copy on your phone.
                </small>
              )}
            </div>
          </article>
        ) : (
          <article className="guest-summary">
            <span>Meeting recording</span>
            <p>The shared audio is no longer available online. The written summary below is still here for you.</p>
          </article>
        )}
        <article className="guest-summary"><span>What you agreed</span><p>{encounter.sharedSummary || "The shared summary is still being prepared."}</p></article>
        <section className="guest-actions">
          <h2>Your next steps</h2>
          {guestActions.length ? guestActions.map((action) => <article key={action.id}><CheckCircleIcon size={24} /><div><strong>{action.title}</strong><small>{action.dueAt ? `Due ${action.dueAt}` : "No due date"} · {action.channel}</small></div></article>) : <p>No actions have been assigned to you.</p>}
        </section>
        <section className="guest-actions">
          <h2>Will you follow up too?</h2>
          {encounter.guestFollowUp?.committedAt ? (
            <article><CheckCircleIcon size={24} weight="fill" /><div><strong>You said you&apos;ll follow up.</strong>{encounter.guestFollowUp.note ? <small>{encounter.guestFollowUp.note}</small> : null}</div></article>
          ) : (
            <>
              <p>Following up isn&apos;t just on them — let them know you&apos;re on it too.</p>
              <textarea
                value={followUpNote}
                onChange={(event) => setFollowUpNote(event.target.value)}
                placeholder="Optional note — what will you follow up on?"
                rows={2}
                maxLength={280}
                style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: "1px solid var(--line)", font: "inherit", resize: "vertical" }}
              />
              {followUpError ? <small style={{ color: "#c0392b", display: "block", marginTop: 4 }}>{followUpError}</small> : null}
              <button
                type="button"
                className="button secondary small"
                disabled={followUpSubmitting}
                onClick={() => void commitFollowUp()}
                style={{ marginTop: 8 }}
              >
                {followUpSubmitting ? "Saving…" : "I'll follow up too"}
              </button>
            </>
          )}
        </section>
        <div className="guest-claim">
          <div><strong>Keep this relationship moving</strong><p>Create your private AfterMeet workspace to claim these actions, receive reminders, and add your own notes.</p></div>
          <LinkButton href={buildAuthHref({ intent: "visitor", shareToken: encounter.shareToken })}>Create account <ArrowRightIcon size={16} weight="bold" /></LinkButton>
        </div>
        <small className="guest-privacy"><LockKeyIcon size={14} weight="bold" />Private notes and the full transcript stay with the host. This page shows the shared summary{sharedRecordingUrl ? " and meeting recording" : ""} only.</small>
      </section>
    </main>
  );
}
