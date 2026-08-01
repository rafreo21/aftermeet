"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { AppShell } from "../../../components/AppShell";
import { StatusMessage } from "../../../components/AsyncState";
import { Button } from "../../../components/Button";
import { SelectField, TextField } from "../../../components/FormField";
import { encounterToApiBody, writeEncounter, type Encounter } from "../../../../lib/encounters";
import { FOLLOW_UP_TEMPLATES, followUpDueDate } from "../../../../lib/follow-up-templates";

type FollowUpChannel = Encounter["actions"][number]["channel"];

const CHANNELS: Array<{ id: FollowUpChannel; label: string }> = [
  { id: "email", label: "Email" },
  { id: "call", label: "Call" },
  { id: "meeting", label: "Meeting" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X" },
  { id: "tiktok", label: "TikTok" },
  { id: "send", label: "Send something" },
  { id: "other", label: "Other" },
];

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function NewFollowUpPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialName = params.get("personName")?.trim() ?? "";
  const initialEmail = params.get("personEmail")?.trim() ?? "";
  const [personName, setPersonName] = useState(initialName);
  const [personEmail, setPersonEmail] = useState(initialEmail);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<FollowUpChannel>("email");
  const [dueAt, setDueAt] = useState(followUpDueDate(1));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTemplate = useMemo(
    () => FOLLOW_UP_TEMPLATES.find((template) => template.channel === channel && template.buildTitle(personName) === title),
    [channel, personName, title],
  );

  function applyTemplate(template: (typeof FOLLOW_UP_TEMPLATES)[number]) {
    setChannel(template.channel);
    setTitle(template.buildTitle(personName));
    setDueAt(followUpDueDate(template.dueInDays));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = personName.trim();
    const cleanTitle = title.trim();
    if (cleanName.length < 2) {
      setError("Add the person this follow-up is for.");
      return;
    }
    if (cleanTitle.length < 2) {
      setError("Describe the next step.");
      return;
    }

    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const sourceId = params.get("sourceId")?.trim() || "";
    const exchangeId = params.get("exchangeId")?.trim() || "";
    const participantId = sourceId || createId();
    const encounter: Encounter = {
      id: createId(),
      title: `Follow-up with ${cleanName}`,
      personName: cleanName,
      personEmail: personEmail.trim(),
      contactId: params.get("contactId") || params.get("contact") || undefined,
      exchangeId: exchangeId || undefined,
      startedAt: now,
      endedAt: now,
      durationSeconds: 0,
      consent: {
        confirmed: false,
        method: "verbal",
        confirmedAt: now,
        scriptVersion: "2026-07-26",
      },
      transcript: "",
      privateNotes: "",
      sharedSummary: "",
      actions: [{
        id: createId(),
        title: cleanTitle,
        channel,
        owner: "me",
        dueAt,
        status: "open",
        assigneeName: cleanName,
        assigneeEmail: personEmail.trim(),
        participantId,
      }],
      participants: [{
        id: participantId,
        name: cleanName,
        email: personEmail.trim(),
        phone: "",
        linkedIn: "",
        exchangeId: exchangeId || undefined,
      }],
      status: "reviewed",
      shareToken: createId().replace(/-/g, ""),
    };

    writeEncounter(encounter);
    try {
      const response = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encounterToApiBody(encounter)),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Could not sync this follow-up.");
      }
      router.push("/app/followups");
    } catch (caught) {
      setError(`${caught instanceof Error ? caught.message : "Could not sync this follow-up."} It is saved on this browser and can be retried later.`);
      setSaving(false);
    }
  }

  return (
    <AppShell
      active="followups"
      title="Add follow-up"
      subtitle="Create a next step without recording a meeting."
      backHref="/app/followups"
    >
      <div className="flow-page quick-follow-up-page">
        <div className="flow-heading">
          <div>
            <span className="step-pill">Quick follow-up</span>
            <h1>What needs to happen next?</h1>
            <p>It will appear in Follow-ups, notifications, history, and this person’s timeline.</p>
          </div>
        </div>

        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

        <form className="contact-form-card quick-follow-up-form" onSubmit={save}>
          <div className="quick-follow-up-person">
            <TextField
              label="Person"
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              placeholder="e.g. Sarah Chen"
              autoComplete="name"
              required
            />
            <TextField
              label="Email"
              hint="Optional"
              type="email"
              value={personEmail}
              onChange={(event) => setPersonEmail(event.target.value)}
              placeholder="sarah@example.com"
              autoComplete="email"
            />
          </div>

          <div className="follow-up-template-picker">
            <div>
              <strong>Start with a template</strong>
              <small>You can edit the wording after selecting one.</small>
            </div>
            <div className="follow-up-template-list">
              {FOLLOW_UP_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`follow-up-template-chip ${selectedTemplate?.id === template.id ? "is-selected" : ""}`}
                  onClick={() => applyTemplate(template)}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <TextField
            label="Next step"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Send Sarah the revised product draft"
            required
          />

          <div className="quick-follow-up-meta">
            <SelectField label="How will you follow up?" value={channel} onChange={(event) => setChannel(event.target.value as FollowUpChannel)}>
              {CHANNELS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </SelectField>
            <TextField label="Due date" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>

          <div className="quick-follow-up-actions">
            <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={saving}><CheckCircleIcon size={18} weight="bold" />Add follow-up</Button>
          </div>
        </form>

        <p className="quick-follow-up-note"><PaperPlaneTiltIcon size={16} weight="bold" />Nothing is sent automatically. AfterMeet reminds you until you complete it.</p>
      </div>
    </AppShell>
  );
}
