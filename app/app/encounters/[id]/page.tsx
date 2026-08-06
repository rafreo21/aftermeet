"use client";

import { useEffect, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { useAppShellChrome } from "../../../components/AppShellChromeContext";
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
import { renameSpeakerAssignees, renameTranscriptSpeakers, transcriptSpeakerLabels } from "../../../../lib/speaker-labels";
import { FOLLOW_UP_TEMPLATES, followUpDueDate } from "../../../../lib/follow-up-templates";

type UploadStatus = "idle" | "uploading" | "uploaded" | "failed";

export default function EncounterReviewPage() {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [encounterId, setEncounterId] = useState("");
  const [newAction, setNewAction] = useState({ title: "", owner: "me" as "me" | "guest", participantId: "", dueAt: "", channel: "email" as EncounterAction["channel"] });
  const [message, setMessage] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionComposerOpen, setActionComposerOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [uploadRetryable, setUploadRetryable] = useState(true);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [localRecordingMimeType, setLocalRecordingMimeType] = useState("audio/mp4");
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    void Promise.resolve().then(() => {
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
      void Promise.resolve().then(() => setUploadStatus("uploaded"));
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
        setUploadRetryable((caught as Error & { retryable?: boolean })?.retryable !== false);
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
      setUploadRetryable((caught as Error & { retryable?: boolean })?.retryable !== false);
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
    patch((current) => {
      const participant = current.participants?.find((person) => person.id === newAction.participantId)
        ?? current.participants?.[0];
      return {
        ...current,
        actions: [...(current.actions ?? []), {
        id: crypto.randomUUID(),
        title: newAction.title.trim(),
        owner: newAction.owner,
        participantId: participant?.id,
        assigneeName: participant?.name,
        assigneeEmail: participant?.email,
        dueAt: newAction.dueAt,
        channel: newAction.channel,
        status: "open",
      }],
      };
    });
    setNewAction({ title: "", owner: "me", participantId: "", dueAt: "", channel: "email" });
    setActionComposerOpen(false);
  }

  function participantName(participantId?: string) {
    if (!participantId) return encounter?.personName || "Guest";
    return encounter?.participants?.find((person) => person.id === participantId)?.name
      || encounter?.personName
      || "Guest";
  }

  function actionOwnerLabel(action: EncounterAction) {
    const person = action.participantId ? participantName(action.participantId) : "";
    if (action.owner === "me") return person ? `You → ${person}` : "You";
    return person || action.assigneeName || encounter?.personName || "Guest";
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

  function confirmReview() {
    if (!encounter || encounter.status !== "draft") return;
    patch((current) => ({ ...current, status: "reviewed" }));
    setMessage("Review confirmed. Your follow-ups are now active.");
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

  useAppShellChrome({ backHref: "/app" });

  if (!encounter) {
    return <div className="empty-state"><div><h2>Encounter not found</h2><p>This local encounter may have been removed or created in another browser.</p><LinkButton href="/app">Back home</LinkButton></div></div>;
  }

  // Encounters created before multi-person capture do not have these arrays.
  // Keep their review pages usable while treating them as single-person records.
  const participants = encounter.participants ?? [];
  const actions = encounter.actions ?? [];
  const speakerLabels = transcriptSpeakerLabels(encounter.transcript);
  const speakerCandidates = Array.from(new Set([
    "Me",
    encounter.personName,
    ...participants.map((person) => person.name),
  ].map((name) => name.trim()).filter(Boolean)));
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
  const openActions = actions.filter((action) => action.status !== "completed");
  const peopleCount = participants.length || (encounter.personName ? 1 : 0);
  const isShared = encounter.status === "shared";
  const isReviewed = encounter.status === "reviewed" || isShared;

  return (
    <>
      <div className="review-layout">
        <main className="review-main">
          <header className="review-heading">
            <div><h1>{encounter.personName || encounter.title}</h1><p>{encounter.personName && encounter.title ? encounter.title : encounter.personName || "Unlinked person"} · {formatDuration(encounter.durationSeconds)}</p></div>
            {encounter.status === "shared" && <CheckCircleIcon size={42} weight="fill" />}
          </header>

          <p className="review-status-line" aria-label="Meeting review summary">
            <span>{peopleCount} {peopleCount === 1 ? "person" : "people"}</span>
            <span>{openActions.length} follow-up{openActions.length === 1 ? "" : "s"}{isReviewed ? "" : " (pending)"}</span>
            <span>{isShared ? "Guest view shared" : isReviewed ? "Reviewed · private" : "Pending review"}</span>
          </p>

          {!isReviewed ? (
            <section className="review-section review-primary-section">
              <header><div><h2>Follow-ups are pending</h2><p>Nothing above is active yet. Confirm your review to turn these follow-ups on. Sharing a guest link is separate and optional.</p></div></header>
              <Button fullWidth onClick={confirmReview}>Confirm review</Button>
            </section>
          ) : null}

          <section className="review-section shared-section review-primary-section">
            <header><span><ShareNetworkIcon size={20} weight="bold" /></span><div><h2>Meeting recap</h2><p>This is what participants will see after you approve the guest view.</p></div></header>
            <TextAreaField label="Shared summary" hint="Participant can see this" rows={4} value={encounter.sharedSummary} onChange={(event) => patch((current) => ({ ...current, sharedSummary: event.target.value }))} />
          </section>

          <section className="review-section">
            <header><span><CheckCircleIcon size={20} weight="bold" /></span><div><h2>Follow-ups</h2><p>Confirm the owner and due date for each commitment.</p></div></header>
            {guestCommitments.length ? (
              <div className="guest-response-list">
                {guestCommitments.map((commitment, index) => (
                  <article key={commitment.id || `${commitment.committedAt}-${index}`}>
                    <CheckCircleIcon size={20} weight="fill" />
                    <div><strong>{commitment.note || "They confirmed they will follow up."}</strong><small>{commitment.guestName || participantName(commitment.participantId) || "Guest"}{commitment.channel ? ` · ${commitment.channel}` : ""}{commitment.dueAt ? ` · due ${commitment.dueAt}` : ""} · shared {new Date(commitment.committedAt).toLocaleDateString()}</small></div>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="action-list">
              {actions.map((action) => {
                const actionContext = buildActionLinkContext(
                  encounter,
                  encounter.contactId ? findContactById(encounter.contactId) : null,
                  action,
                );
                return <article key={action.id}>
                  <button
                    className={action.status === "completed" ? "action-check complete" : "action-check"}
                    onClick={() => patch((current) => ({
                      ...current,
                      actions: (current.actions ?? []).map((item) => item.id === action.id
                        ? item.status === "completed"
                          ? { ...item, status: "open", completedAt: undefined }
                          : { ...item, status: "completed", completedAt: new Date().toISOString() }
                        : item),
                    }))}
                    aria-label={action.status === "completed" ? "Mark open" : "Mark complete"}
                  ><CheckCircleIcon size={22} weight={action.status === "completed" ? "fill" : "regular"} /></button>
                  <div><strong>{action.title}</strong><small>{actionOwnerLabel(action)}{action.dueAt ? ` · due ${action.dueAt}` : ""} · {channelLabel(action.channel)}</small></div>
                  <button
                    type="button"
                    className="action-edit"
                    aria-label={`Edit owner and due date for ${action.title}`}
                    aria-expanded={editingActionId === action.id}
                    onClick={() => setEditingActionId((current) => current === action.id ? "" : action.id)}
                  ><PencilSimpleIcon size={17} weight="bold" />Edit</button>
                  {editingActionId === action.id ? (
                    <div className="action-inline-editor">
                      <SelectField
                        label="Owner"
                        value={action.owner === "me" ? "me" : action.participantId || "guest"}
                        onChange={(event) => {
                          const value = event.target.value;
                          const participant = participants.find((person) => person.id === value);
                          patch((current) => ({
                            ...current,
                            actions: (current.actions ?? []).map((item) => item.id !== action.id ? item : value === "me"
                              ? { ...item, owner: "me" }
                              : {
                                ...item,
                                owner: "guest",
                                participantId: participant?.id,
                                assigneeName: participant?.name || current.personName || "Guest",
                                assigneeEmail: participant?.email || item.assigneeEmail,
                              }),
                          }));
                        }}
                      >
                        <option value="me">Me</option>
                        {participants.length ? participants.map((person) => (
                          <option key={person.id} value={person.id}>{person.name || "Guest"}</option>
                        )) : <option value="guest">{encounter.personName || "Guest"}</option>}
                      </SelectField>
                      {action.owner === "me" && participants.length ? (
                        <SelectField
                          label="For person"
                          value={action.participantId || participants[0]?.id || ""}
                          onChange={(event) => {
                            const participant = participants.find((person) => person.id === event.target.value);
                            patch((current) => ({
                              ...current,
                              actions: (current.actions ?? []).map((item) => item.id === action.id
                                ? {
                                  ...item,
                                  participantId: participant?.id,
                                  assigneeName: participant?.name,
                                  assigneeEmail: participant?.email,
                                }
                                : item),
                            }));
                          }}
                        >
                          {participants.map((person) => (
                            <option key={person.id} value={person.id}>{person.name || "Guest"}</option>
                          ))}
                        </SelectField>
                      ) : null}
                      <TextField
                        label="Due date"
                        type="date"
                        value={action.dueAt || ""}
                        onChange={(event) => patch((current) => ({
                          ...current,
                          actions: (current.actions ?? []).map((item) => item.id === action.id
                            ? { ...item, dueAt: event.target.value }
                            : item),
                        }))}
                      />
                      <Button variant="secondary" onClick={() => setEditingActionId("")}>Done</Button>
                    </div>
                  ) : null}
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
                        actions: (current.actions ?? []).map((item) => item.id === next.id ? next : item),
                      }))}
                    />
                  ) : null}
                </article>;
              })}
              {!actions.length && <p className="muted-copy">No follow-ups yet. Add one below if this meeting needs a next step.</p>}
            </div>
            <button
              type="button"
              className="review-add-action-toggle"
              onClick={() => setActionComposerOpen((value) => !value)}
              aria-expanded={actionComposerOpen}
            >
              <span><PlusIcon size={16} weight="bold" />Add another follow-up</span>
              {actionComposerOpen ? <CaretUpIcon size={16} weight="bold" /> : <CaretDownIcon size={16} weight="bold" />}
            </button>
            {actionComposerOpen ? <div className="new-action">
              <div className="follow-up-template-picker">
                <div><strong>Start with a template</strong><small>Choose a common next step, then adjust the owner or date.</small></div>
                <div className="follow-up-template-list" role="list" aria-label="Follow-up templates">
                  {FOLLOW_UP_TEMPLATES.map((template) => {
                    const personName = encounter.participants?.map((person) => person.name).filter(Boolean).join(", ") || encounter.personName;
                    const title = template.buildTitle(personName);
                    const selected = newAction.title === title && newAction.channel === template.channel;
                    return <button
                      key={template.id}
                      type="button"
                      className={selected ? "follow-up-template-chip is-selected" : "follow-up-template-chip"}
                      aria-pressed={selected}
                      onClick={() => setNewAction((current) => ({
                        ...current,
                        title,
                        channel: template.channel,
                        dueAt: followUpDueDate(template.dueInDays),
                      }))}
                    >{template.label}</button>;
                  })}
                </div>
              </div>
              <TextField label="Follow-up" value={newAction.title} onChange={(event) => setNewAction((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Send the introduction" />
              <SelectField
                label="Owner"
                value={newAction.owner === "guest" ? newAction.participantId || "guest" : "me"}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewAction((current) => value === "me"
                    ? { ...current, owner: "me" }
                    : { ...current, owner: "guest", participantId: value === "guest" ? "" : value });
                }}
              >
                <option value="me">Me</option>
                {participants.length > 1 ? (
                  participants.map((person) => (
                    <option key={person.id} value={person.id}>{person.name || "Guest"}</option>
                  ))
                ) : (
                  <option value="guest">{encounter.personName || "Guest"}</option>
                )}
              </SelectField>
              {newAction.owner === "me" && participants.length ? (
                <SelectField
                  label="For person"
                  value={newAction.participantId || participants[0]?.id || ""}
                  onChange={(event) => setNewAction((current) => ({ ...current, participantId: event.target.value }))}
                >
                  {participants.map((person) => (
                    <option key={person.id} value={person.id}>{person.name || "Guest"}</option>
                  ))}
                </SelectField>
              ) : null}
              <SelectField label="Channel" value={newAction.channel} onChange={(event) => setNewAction((current) => ({ ...current, channel: event.target.value as EncounterAction["channel"] }))}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="send">Send something</option>
              </SelectField>
              <TextField label="Due" type="date" value={newAction.dueAt} onChange={(event) => setNewAction((current) => ({ ...current, dueAt: event.target.value }))} />
              <Button size="small" onClick={addAction}><PlusIcon size={15} weight="bold" />Add</Button>
            </div> : null}
          </section>

          <section className="review-section private-section review-details-section">
            <button type="button" className="review-details-toggle" onClick={() => setDetailsOpen((value) => !value)} aria-expanded={detailsOpen}>
              <span><LockKeyIcon size={20} weight="bold" /></span>
              <div><strong>Meeting details</strong><small>Recording, transcript, speaker names, and private notes</small></div>
              {detailsOpen ? <CaretUpIcon size={17} weight="bold" /> : <CaretDownIcon size={17} weight="bold" />}
            </button>
            {detailsOpen ? <div className="review-details-content">
              {localAudioUrl ? (
                <article className="review-recording-detail">
                  <strong>Recording</strong>
                  <audio controls preload="metadata" src={localAudioUrl} />
                </article>
              ) : null}
              {encounter.transcript.trim() ? (
              <>
                <button type="button" className="review-transcript-toggle" onClick={() => setTranscriptOpen((value) => !value)} aria-expanded={transcriptOpen}>
                  <div><strong>Full transcript</strong><small>{transcriptOpen ? "Hide the raw transcript while you focus on what to share." : "Expand to edit the full transcript. Collapsed by default on review."}</small></div>
                  {transcriptOpen ? <CaretUpIcon size={16} weight="bold" /> : <CaretDownIcon size={16} weight="bold" />}
                </button>
                {transcriptOpen ? (
                  <>
                    {speakerLabels.length ? (
                      <div className="speaker-identity-editor">
                        <div>
                          <strong>Identify speakers</strong>
                          <small>Confirm who each detected voice belongs to before you review the summary.</small>
                        </div>
                        {speakerLabels.map((label) => (
                          <label key={label}>
                            <span>{label}</span>
                            <select
                              value={speakerNames[label] || ""}
                              onChange={(event) => setSpeakerNames((current) => ({ ...current, [label]: event.target.value }))}
                            >
                              <option value="">Choose a person</option>
                              {speakerCandidates.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
                            </select>
                          </label>
                        ))}
                        <Button
                          variant="secondary"
                          disabled={!speakerLabels.every((label) => speakerNames[label])}
                          onClick={() => {
                            patch((current) => ({
                              ...current,
                              transcript: renameTranscriptSpeakers(current.transcript, speakerNames),
                              actions: renameSpeakerAssignees(current.actions ?? [], speakerNames, current.participants ?? []),
                            }));
                            setMessage("Speaker names applied to the transcript and follow-up owners.");
                          }}
                        >Apply speaker names</Button>
                      </div>
                    ) : null}
                    <TextAreaField label="Full transcript" hint="Private" rows={8} value={encounter.transcript} onChange={(event) => patch((current) => ({ ...current, transcript: event.target.value }))} />
                  </>
                ) : null}
              </>
            ) : (
              <p className="muted-copy">No transcript saved for this encounter.</p>
            )}
            <TextAreaField label="Private notes" hint="Only you" rows={4} value={encounter.privateNotes} onChange={(event) => patch((current) => ({ ...current, privateNotes: event.target.value }))} />
            </div> : null}
          </section>
        </main>

        <aside className="share-rail">
          <span>{encounter.status === "shared" ? "Ready to share" : "Optional"}</span>
          <h2>{encounter.status === "shared" ? "The guest view is ready." : "Share when you’re ready."}</h2>
          <p>{encounter.status === "shared" ? "Send the secure link yourself. Nothing is sent automatically." : `Creating a guest link also confirms your review, if you haven’t already. Shared recordings remain online for ${CLOUD_RECORDING_RETENTION_DAYS} days.`}</p>
          {participants.length > 1 ? (
            participants.map((person) => (
              <div className="guest-card" key={person.id}><strong>{person.name || "Guest participant"}</strong><small>{person.email || "No email added"}</small></div>
            ))
          ) : (
            <div className="guest-card"><strong>{encounter.personName || "Guest participant"}</strong><small>{encounter.personEmail || "No email added"}</small></div>
          )}
          {uploadStatus === "uploading" ? <p className="muted-copy" role="status">Uploading recording for guest sharing…</p> : null}
          {uploadStatus === "uploaded" && cloudAvailableUntil && !cloudExpired ? (
            <p className="muted-copy">Guests can play or download until {cloudAvailableUntil}.</p>
          ) : null}
          {uploadStatus === "failed" ? (
            <>
              <p className="share-message" role="status">{uploadError || "Upload failed."}</p>
              {uploadRetryable ? <Button fullWidth variant="secondary" onClick={() => void retryUpload()}>Retry upload</Button> : null}
            </>
          ) : null}
          {encounter.status !== "shared" ? (
            <Button fullWidth onClick={approveAndShare}><CheckCircleIcon size={18} weight="bold" />Approve and create link</Button>
          ) : (
            <Button fullWidth onClick={() => void copyGuestLink()}><CopyIcon size={18} weight="bold" />Copy guest link</Button>
          )}
          {encounter.status === "shared" && encounter.personEmail ? (
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
          <small>{encounter.status === "shared" ? "Only the approved recap and participant follow-ups are visible." : "Keep this private by leaving it as a draft."}</small>
          {message && <p className="share-message" role="status">{message}</p>}
        </aside>
      </div>
    </>
  );
}
