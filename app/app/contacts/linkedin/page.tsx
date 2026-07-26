"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { AppShell } from "../../../components/AppShell";
import { StatusMessage } from "../../../components/AsyncState";
import { Button, LinkButton } from "../../../components/Button";
import { TextAreaField, TextField } from "../../../components/FormField";
import { type Contact } from "../../../../lib/contacts";
import { resolveAndSaveContact } from "../../../../lib/person-links";
import { normalizeLinkedInUrl, parseLinkedInProfileInput } from "../../../../lib/linkedin-profile";
import "../../product.css";
import "../../flow.css";

type LinkedInProfileResponse = {
  profile?: {
    firstName?: string;
    lastName?: string;
    role?: string;
    company?: string;
    linkedinUrl?: string;
    handle?: string;
  };
  source?: "opengraph" | "url_only";
  message?: string;
  error?: string;
};

const emptyProfileFields = {
  firstName: "",
  lastName: "",
  role: "",
  company: "",
};

export default function LinkedInImportPage() {
  const [input, setInput] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("url") ?? "";
  });
  const [form, setForm] = useState({
    ...emptyProfileFields,
    context: "Added from LinkedIn.",
  });
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "ready" | "partial">("idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const lookupRequestRef = useRef(0);
  const activeHandleRef = useRef("");

  const parsed = useMemo(() => parseLinkedInProfileInput(input), [input]);
  const linkedinUrl = parsed ? normalizeLinkedInUrl(parsed.url) : "";

  function applyVerifiedProfile(payload: LinkedInProfileResponse) {
    if (payload.source !== "opengraph" || !payload.profile) return;
    setForm((current) => ({
      ...current,
      firstName: payload.profile?.firstName?.trim() || "",
      lastName: payload.profile?.lastName?.trim() || "",
      role: payload.profile?.role?.trim() || "",
      company: payload.profile?.company?.trim() || "",
    }));
  }

  async function loadProfileDetails(url: string, handle: string, requestId: number) {
    setLookupStatus("loading");
    setLookupMessage("Checking LinkedIn for verified public profile details…");
    try {
      const response = await fetch(`/api/linkedin/profile?url=${encodeURIComponent(url)}`);
      const payload = await response.json() as LinkedInProfileResponse;
      if (requestId !== lookupRequestRef.current || activeHandleRef.current !== handle) return;

      if (!response.ok) {
        setLookupStatus("partial");
        setLookupMessage(payload.error || "Could not load profile details. Add what you remember below.");
        return;
      }

      if (payload.source === "opengraph") {
        applyVerifiedProfile(payload);
        setLookupStatus("ready");
      } else {
        setLookupStatus("partial");
      }
      setLookupMessage(payload.message || "Profile link saved. Add what you remember from the conversation.");
      setError("");
    } catch {
      if (requestId !== lookupRequestRef.current || activeHandleRef.current !== handle) return;
      setLookupStatus("partial");
      setLookupMessage("Could not reach LinkedIn. Add name, role, and company from your conversation.");
    }
  }

  useEffect(() => {
    if (!parsed?.url || !parsed.handle) {
      activeHandleRef.current = "";
      setLookupStatus("idle");
      setLookupMessage("");
      return;
    }

    if (activeHandleRef.current !== parsed.handle) {
      activeHandleRef.current = parsed.handle;
      setSavedId("");
      setForm((current) => ({
        ...current,
        ...emptyProfileFields,
      }));
    }

    const requestId = lookupRequestRef.current + 1;
    lookupRequestRef.current = requestId;
    const timeout = window.setTimeout(() => {
      void loadProfileDetails(parsed.url, parsed.handle, requestId);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [parsed?.url, parsed?.handle]);

  function refreshProfile() {
    if (!parsed?.url || !parsed.handle) {
      setError("Paste a LinkedIn profile URL like linkedin.com/in/username.");
      return;
    }
    const requestId = lookupRequestRef.current + 1;
    lookupRequestRef.current = requestId;
    void loadProfileDetails(parsed.url, parsed.handle, requestId);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed) {
      setError("Paste a LinkedIn profile URL like linkedin.com/in/username.");
      return;
    }
    if (!form.firstName.trim()) {
      setError("Add at least a first name.");
      return;
    }

    const contact: Contact = {
      id: `linkedin-${parsed.handle}`,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: "",
      linkedinUrl,
      company: form.company.trim(),
      role: form.role.trim(),
      context: form.context.trim(),
      source: "linkedin",
    };
    resolveAndSaveContact(contact);
    setSavedId(contact.id);
  }

  return (
    <AppShell
      active="contacts"
      title="Add from LinkedIn"
      subtitle="Paste a profile URL after a badge scan or a quick hallway intro."
      actions={
        <LinkButton size="small" variant="ghost" href="/app/contacts">
          <ArrowLeftIcon size={16} />Contacts
        </LinkButton>
      }
    >
      <form className="contact-form-card" onSubmit={save}>
        <header>
          <span className="step-pill">Capture people</span>
          <h1><LinkedinLogoIcon size={28} weight="bold" />LinkedIn profile</h1>
          <p>We’ll save the profile link. If LinkedIn exposes verified public details, we’ll fill them in — otherwise add what you remember from the conversation.</p>
        </header>
        <TextField
          label="LinkedIn URL"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="https://www.linkedin.com/in/username"
          error={error}
        />
        {parsed ? (
          <StatusMessage tone={lookupStatus === "ready" ? "success" : lookupStatus === "loading" ? "info" : "info"}>
            {lookupStatus === "loading"
              ? `Checking @${parsed.handle}…`
              : lookupMessage || `Saved profile link for @${parsed.handle}.`}
          </StatusMessage>
        ) : input.trim() ? (
          <StatusMessage tone="error">That doesn’t look like a LinkedIn profile URL.</StatusMessage>
        ) : null}
        <div className="form-actions align-start">
          <Button type="button" variant="secondary" loading={lookupStatus === "loading"} onClick={refreshProfile}>
            <ArrowsClockwiseIcon size={16} weight="bold" />Check LinkedIn again
          </Button>
        </div>
        <div className="field-row two">
          <TextField label="First name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="From the conversation" />
          <TextField label="Last name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Optional" />
        </div>
        <div className="field-row two">
          <TextField label="Role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} placeholder="e.g. Product designer" />
          <TextField label="Company" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} placeholder="e.g. Northstar" />
        </div>
        <TextAreaField
          label="What mattered?"
          hint="Private"
          value={form.context}
          onChange={(event) => setForm((current) => ({ ...current, context: event.target.value }))}
          rows={3}
          placeholder="Optional notes from the conversation."
        />
        {savedId ? (
          <StatusMessage tone="success">Saved to your contacts.</StatusMessage>
        ) : null}
        <div className="form-actions">
          <LinkButton variant="ghost" href="/app/contacts">Cancel</LinkButton>
          {!savedId ? (
            <Button type="submit"><FloppyDiskIcon size={18} weight="bold" />Save contact</Button>
          ) : (
            <>
              <LinkButton variant="secondary" href={`/app/contacts/${savedId}`}>Open contact</LinkButton>
              <LinkButton href={`/app/encounters/new?contact=${encodeURIComponent(savedId)}`}>
                <MicrophoneIcon size={18} weight="fill" />Capture moment
              </LinkButton>
            </>
          )}
        </div>
      </form>
    </AppShell>
  );
}
