"use client";

import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { AppShell } from "../../../components/AppShell";
import { ActionDoButton } from "../../../components/ActionDoButton";
import { OutboundDraftPanel } from "../../../components/OutboundDraftPanel";
import { Button, LinkButton } from "../../../components/Button";
import { TextAreaField, SelectField, TextField } from "../../../components/FormField";
import { buildActionLinkContext, channelLabel } from "../../../../lib/action-links";
import { findContactById } from "../../../../lib/contacts";
import { encounterFromApi, encounterToApiBody, formatDuration, readEncounters, updateEncounter, writeEncounter, type Encounter, type EncounterAction } from "../../../../lib/encounters";
import { supportsOutboundDraft } from "../../../../lib/outbound-habit";
import { readLocalRecording } from "../../../../lib/local-recordings";
import { uploadEncounterRecording } from "../../../../lib/recording-upload";
import {
  CLOUD_RECORDING_RETENTION_DAYS,
  formatRecordingAvailableUntil,
  hasActiveCloudRecording,
  isCloudRecordingExpired,
} from "../../../../lib/recording-metadata";
import { formatMeetingEmailDate, recordingShareMailtoHref } from "../../../../lib/recording-email";
import "../../product.css";
import "../../flow.css";

type UploadStatus = "idle" | "uploading" | "uploaded" | "failed";

export default function EncounterReviewPage() {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [encounterId, setEncounterId] = useState("");
  const [newAction, setNewAction] = useState({ title: "", owner: "me" as "me" | "guest", participantId: "", dueAt: "", channel: "email" as EncounterAction["channel"] });
  const [message, setMessage] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [localRecordingMimeType, setLocalRecordingMimeType] = useState("audio/mp4");

  const actionContext = encounter
    ? buildActionLinkContext(
      encounter,
      encounter.contactId ? findContactById(encounter.contactId) : null,
    )
    : null;

  const reviewSteps = [
    { label: "Record", short: "Capture", Icon: MicrophoneIcon },
    { label: "Context", short: "Context", Icon: MagicWandIcon },
    { label: "Connect", short: "Connect", Icon: IdentificationCardIcon },
    { label: "Follow-up", short: "Follow-up", Icon: PaperPlaneTiltIcon },
    { label: "Review", short: "Review", Icon: EyeIcon },
  ] as const;

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
    void fetch(`/api/encounters/${id}`)
      .then(async (response) => {
        if (response.ok) {
          const payload = await response.json() as { encounter?: Encounter };
          if (payload.encounter) {
            writeEncounter(payload.encounter);
            setEncounter(payload.encounter);
            return;
          }
        }
        setEncounter(readEncounters().find((item) => item.id === id) ?? null);
      })
      .catch(() => {
        setEncounter(readEncounters().find((item) => item.id === id) ?? null);
      });
  }, []);

  useEffect(() => {
    if (!encounterId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void readLocalRecording(encounterId).then((local) => {
      if (cancelled || !local) return;
      objectUrl = URL.createObjectURL(local.blob);
      setLocalAudioUrl(objectUrl);
      setLocalRecordingMimeType(local.metadata.mimeType || local.blob.type || "audio/mp4");
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [encounterId]);

  useEffect(() => {
    if (!encounter || !localAudioUrl) return;
    if (hasActiveCloudRecording(encounter.recording)) {
      setUploadStatus("uploaded");
      return;
    }
    let cancelled = false;
    void (async () => {
      setUploadStatus("uploading");
      setUploadError("");
      try {
        const local = await readLocalRecording(encounter.id);
        if (cancelled || !local) {
          setUploadStatus("idle");
          return;
        }
        const uploaded = await uploadEncounterRecording(encounter.id, local.blob, local.metadata.mimeType);
        if (cancelled) return;
        const next = { ...encounter, recording: uploaded };
        writeEncounter(next);
        setEncounter(next);
        setUploadStatus("uploaded");
        await fetch("/api/encounters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(encounterToApiBody(next)),
        });
      } catch (caught) {
        if (cancelled) return;
        setUploadStatus("failed");
        setUploadError(caught instanceof Error ? caught.message : "Could not upload recording for guests.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [encounter?.id, localAudioUrl]);

  async function retryUpload() {
    if (!encounter) return;
    const local = await readLocalRecording(encounter.id);
    if (!local) {
      setUploadError("No local recording found in this browser.");
      setUploadStatus("failed");
      return;
    }
    setUploadStatus("uploading");
    setUploadError("");
    try {
      const uploaded = await uploadEncounterRecording(encounter.id, local.blob, local.metadata.mimeType);
      const next = { ...encounter, recording: uploaded };
      writeEncounter(next);
      setEncounter(next);
      setUploadStatus("uploaded");
      await syncEncounter(next);
      setMessage("Recording uploaded for guest sharing.");
    } catch (caught) {
      setUploadStatus("failed");
      setUploadError(caught instanceof Error ? caught.message : "Could not upload recording for guests.");
    }
  }

  async function syncEncounter(next: Encounter) {
    writeEncounter(next);
    try {
      await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encounterToApiBody(next)),
      });
    } catch {}
  }

  function patch(updater: (current: Encounter) => Encounter) {
    const updated = updateEncounter(encounterId, updater);
    if (updated) void syncEncounter(updated);
    setEncounter(updated);
  }

  function addAction() {
    if (!newAction.title.trim()) return;
    patch((current) => ({
      ...current,
      actions: [...current.actions, {
        id: crypto.randomUUID(),
        title: newAction.title.trim(),
        owner: newAction.owner,
        participantId: newAction.owner === "guest" ? newAction.participantId || undefined : undefined,
        dueAt: newAction.dueAt,
        channel: newAction.channel,
        status: "open",
      }],
    }));
    setNewAction({ title: "", owner: "me", participantId: "", dueAt: "", channel: "email" });
  }

  function participantName(participantId?: string) {
    if (!participantId) return encounter?.personName || "Guest";
    return encounter?.participants.find((person) => person.id === participantId)?.name
      || encounter?.personName
      || "Guest";
  }

  async function copyGuestLink() {
    if (!encounter) return;
    if (encounter.status !== "shared") {
      setMessage("Approve the shared record before copying the guest link.");
      return;
    }
    const url = `${window.location.origin}/e/${encounter.shareToken}`;
    await navigator.clipboard.writeText(url);
    setMessage("Guest link copied.");
  }

  function approveAndShare() {
    if (!encounter) return;
    if (!encounter.sharedSummary.trim()) {
      setMessage("Add a shared summary before approving the guest view.");
      return;
    }
    const needsCloud = Boolean(localAudioUrl || encounter.recording || encounter.durationSeconds > 0);
    if (needsCloud && !hasActiveCloudRecording(encounter.recording) && uploadStatus !== "uploaded") {
      setMessage("Upload the recording for guests first, or retry the upload below.");
      return;
    }
    patch((current) => ({ ...current, status: "shared" }));
    setMessage("Shared view is ready. Nothing has been sent automatically.");
  }

  if (!encounter) {
    return <AppShell active="home" title="Encounter"><div className="empty-state"><div><h2>Encounter not found</h2><p>This local encounter may have been removed or created in another browser.</p><LinkButton href="/app">Back home</LinkButton></div></div></AppShell>;
  }

  const guestUrl = `${window.location.origin}/e/${encounter.shareToken}`;
  const guestCommitments = encounter.guestFollowUps?.length
    ? encounter.guestFollowUps
    : encounter.guestFollowUp
      ? [encounter.guestFollowUp]
      : [];
  const cloudExpired = isCloudRecordingExpired(encounter.recording);
  const cloudAvailableUntil = formatRecordingAvailableUntil(encounter.recording?.cloudExpiresAt);
  const recordingEmailHref = recordingShareMailtoHref({
    title: encounter.title,
    personName: encounter.personName,
    personEmail: encounter.personEmail,
    guestUrl,
    sharedSummary: encounter.sharedSummary,
    meetingDate: formatMeetingEmailDate(encounter.startedAt),
    cloudExpired,
  });
  const showEmailRecording = Boolean(localAudioUrl && (cloudExpired || uploadStatus === "failed" || !hasActiveCloudRecording(encounter.recording)));

  return (
    <AppShell
      active="home"
      title="Review encounter"
      subtitle="Decide what stays private, what is shared, and who owns each next step."
      actions={<LinkButton size="small" variant="ghost" href="/app"><ArrowLeftIcon size={16} weight="bold" />Back</LinkButton>}
    >
      <div className="review-layout">
        <main className="review-main">
          <nav className="review-journey" aria-label="Encounter capture progress">
            <div className="creator-steps encounter-steps">
              {reviewSteps.map(({ label, short, Icon }, index) => (
                <button
                  key={label}
                  type="button"
                  aria-current={index === 3 ? "step" : undefined}
                  className={[index === 3 ? "active" : "complete"].join(" ")}
                  tabIndex={-1}
                >
                  <span><CheckCircleIcon weight="fill" /></span>
                  <small>{short}</small>
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
          </nav>

          <header className="review-heading">
            <div><span className="step-pill">Step 5 of 5 · Review</span><h1>{encounter.personName || encounter.title}</h1><p>{encounter.personName && encounter.title ? encounter.title : encounter.personName || "Unlinked person"} · {formatDuration(encounter.durationSeconds)} · consent recorded by {encounter.consent.method}</p></div>
            {encounter.status === "shared" && <CheckCircleIcon size={42} weight="fill" />}
          </header>

          <section className="review-section private-section">
            <header><span><LockKeyIcon size={20} weight="bold" /></span><div><h2>Your private context</h2><p>This content is never visible in the guest view.</p></div></header>
            {encounter.transcript.trim() ? (
              <>
                <button type="button" className="review-transcript-toggle" onClick={() => setTranscriptOpen((value) => !value)} aria-expanded={transcriptOpen}>
                  <div><strong>Full transcript</strong><small>{transcriptOpen ? "Hide the raw transcript while you focus on what to share." : "Expand to edit the full transcript — collapsed by default on review."}</small></div>
                  {transcriptOpen ? <CaretUpIcon size={16} weight="bold" /> : <CaretDownIcon size={16} weight="bold" />}
                </button>
                {transcriptOpen && <TextAreaField label="Full transcript" hint="Private" rows={8} value={encounter.transcript} onChange={(event) => patch((current) => ({ ...current, transcript: event.target.value }))} />}
              </>
            ) : (
              <p className="muted-copy">No transcript saved for this encounter.</p>
            )}
            <TextAreaField label="Private notes" hint="Only you" rows={4} value={encounter.privateNotes} onChange={(event) => patch((current) => ({ ...current, privateNotes: event.target.value }))} />
          </section>

          <section className="review-section shared-section">
            <header><span><ShareNetworkIcon size={20} weight="bold" /></span><div><h2>Shared meeting record</h2><p>Only this approved summary and guest-assigned actions appear for the other person.</p></div></header>
            <TextAreaField label="Shared summary" hint="Participant can see this" rows={5} value={encounter.sharedSummary} onChange={(event) => patch((current) => ({ ...current, sharedSummary: event.target.value }))} />
          </section>

          <section className="review-section">
            <header><span><CheckCircleIcon size={20} weight="bold" /></span><div><h2>Next actions</h2><p>Assign each promise clearly. Every open action appears in the right person’s Inbox.</p></div></header>
            {guestCommitments.length ? (
              <div className="guest-response-list">
                <span className="step-pill">Confirmed by participants</span>
                {guestCommitments.map((commitment, index) => (
                  <article key={commitment.id || `${commitment.committedAt}-${index}`}>
                    <CheckCircleIcon size={20} weight="fill" />
                    <div><strong>{commitment.note || "They confirmed they will follow up."}</strong><small>{commitment.guestName || participantName(commitment.participantId) || "Guest"} · shared {new Date(commitment.committedAt).toLocaleDateString()}</small></div>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="action-list">
              {encounter.actions.map((action) => (
                <article key={action.id}>
                  <button
                    className={action.status === "completed" ? "action-check complete" : "action-check"}
                    onClick={() => patch((current) => ({ ...current, actions: current.actions.map((item) => item.id === action.id ? { ...item, status: item.status === "completed" ? "open" : "completed" } : item) }))}
                    aria-label={action.status === "completed" ? "Mark open" : "Mark complete"}
                  ><CheckCircleIcon size={22} weight={action.status === "completed" ? "fill" : "regular"} /></button>
                  <div><strong>{action.title}</strong><small>{action.owner === "me" ? "You" : participantName(action.participantId)}{action.dueAt ? ` · due ${action.dueAt}` : ""} · {channelLabel(action.channel)}</small></div>
                  {actionContext && <ActionDoButton action={action} context={actionContext} showSecondary />}
                  {actionContext && action.owner === "me" && supportsOutboundDraft(action.channel) ? (
                    <OutboundDraftPanel
                      compact
                      encounter={encounter}
                      action={action}
                      context={actionContext}
                      contact={encounter.contactId ? findContactById(encounter.contactId) : null}
                      onActionChange={(next) => patch((current) => ({
                        ...current,
                        actions: current.actions.map((item) => item.id === next.id ? next : item),
                      }))}
                    />
                  ) : null}
                </article>
              ))}
              {!encounter.actions.length && <p className="muted-copy">No actions yet. Add the first commitment below.</p>}
            </div>
            <div className="new-action">
              <TextField label="Action" value={newAction.title} onChange={(event) => setNewAction((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Send the introduction" />
              <SelectField
                label="Owner"
                value={newAction.owner === "guest" ? newAction.participantId || "guest" : "me"}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewAction((current) => value === "me"
                    ? { ...current, owner: "me", participantId: "" }
                    : { ...current, owner: "guest", participantId: value === "guest" ? "" : value });
                }}
              >
                <option value="me">Me</option>
                {encounter.participants.length > 1 ? (
                  encounter.participants.map((person) => (
                    <option key={person.id} value={person.id}>{person.name || "Guest"}</option>
                  ))
                ) : (
                  <option value="guest">{encounter.personName || "Guest"}</option>
                )}
              </SelectField>
              <SelectField label="Channel" value={newAction.channel} onChange={(event) => setNewAction((current) => ({ ...current, channel: event.target.value as EncounterAction["channel"] }))}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="send">Send something</option>
              </SelectField>
              <TextField label="Due" type="date" value={newAction.dueAt} onChange={(event) => setNewAction((current) => ({ ...current, dueAt: event.target.value }))} />
              <Button size="small" onClick={addAction}><PlusIcon size={15} weight="bold" />Add</Button>
            </div>
          </section>
        </main>

        <aside className="share-rail">
          <span>Participant access</span>
          <h2>Keep both people aligned.</h2>
          <p>Upload the recording, approve the shared record, then send the secure link yourself. Cloud copies stay online for {CLOUD_RECORDING_RETENTION_DAYS} days.</p>
          {encounter.participants.length > 1 ? (
            encounter.participants.map((person) => (
              <div className="guest-card" key={person.id}><strong>{person.name || "Guest participant"}</strong><small>{person.email || "No email added"}</small></div>
            ))
          ) : (
            <div className="guest-card"><strong>{encounter.personName || "Guest participant"}</strong><small>{encounter.personEmail || "No email added"}</small></div>
          )}
          {localAudioUrl ? (
            <article className="guest-summary">
              <span>Your recording</span>
              <audio controls preload="metadata" src={localAudioUrl} style={{ width: "100%", marginTop: 12 }} />
            </article>
          ) : null}
          {uploadStatus === "uploading" ? <p className="muted-copy" role="status">Uploading recording for guest sharing…</p> : null}
          {uploadStatus === "uploaded" && cloudAvailableUntil && !cloudExpired ? (
            <p className="muted-copy">Guests can play or download until {cloudAvailableUntil}.</p>
          ) : null}
          {uploadStatus === "failed" ? (
            <>
              <p className="share-message" role="status">{uploadError || "Upload failed."}</p>
              <Button fullWidth variant="secondary" onClick={() => void retryUpload()}>Retry upload</Button>
            </>
          ) : null}
          <Button fullWidth onClick={approveAndShare} disabled={encounter.status === "shared"}><CheckCircleIcon size={18} weight="bold" />{encounter.status === "shared" ? "Guest view approved" : "Approve shared record"}</Button>
          <Button fullWidth variant="secondary" onClick={() => void copyGuestLink()}><CopyIcon size={18} weight="bold" />Copy guest link</Button>
          {encounter.personEmail ? (
            <a className="email-invite" href={recordingShareMailtoHref({
              title: encounter.title,
              personName: encounter.personName,
              personEmail: encounter.personEmail,
              guestUrl,
              sharedSummary: encounter.sharedSummary,
              meetingDate: formatMeetingEmailDate(encounter.startedAt),
              cloudExpired,
            })}><EnvelopeSimpleIcon size={18} weight="bold" />Email guest link</a>
          ) : null}
          {showEmailRecording ? (
            <>
              <a className="email-invite" href={recordingEmailHref}><EnvelopeSimpleIcon size={18} weight="bold" />Email recording + details</a>
              <a className="email-invite" href={localAudioUrl ?? "#"} download={`${encounter.title.replace(/[^\w\- ]+/g, "").trim() || "aftermeet"}-recording.${localRecordingMimeType.includes("wav") ? "wav" : "m4a"}`}>Download recording for attachment</a>
              <small>Email apps cannot attach files automatically. Download the recording, then attach it in your email draft.</small>
            </>
          ) : null}
          <small>AfterMeet never sends or approves a follow-up without you.</small>
          {message && <p className="share-message" role="status">{message}</p>}
        </aside>
      </div>
    </AppShell>
  );
}
