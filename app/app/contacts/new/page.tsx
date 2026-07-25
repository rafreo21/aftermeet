"use client";

import { useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { AppShell } from "../../../components/AppShell";
import { Button, LinkButton } from "../../../components/Button";
import { TextAreaField, TextField } from "../../../components/FormField";
import "../../product.css";
import "../../flow.css";

export default function NewContactPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "", context: "", nextAction: "" });
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.firstName.trim()) { setError("Add at least a first name."); return; }
    const contact = { ...form, id: crypto.randomUUID(), createdAt: Date.now() };
    try {
      const contacts = JSON.parse(localStorage.getItem("aftermeet-contacts-v1") || "[]");
      localStorage.setItem("aftermeet-contacts-v1", JSON.stringify([contact, ...contacts]));
      localStorage.setItem("aftermeet-last-contact-v1", JSON.stringify(contact));
    } catch {}
    window.location.href = "/app/followups";
  }

  return (
    <AppShell active="contacts" title="New contact" subtitle="Capture who they are, what mattered, and what happens next." actions={<LinkButton size="small" variant="ghost" href="/app/contacts"><ArrowLeftIcon size={16} />Cancel</LinkButton>}>
      <form className="contact-form-card" onSubmit={save}>
        <header><span className="step-pill">Meeting capture</span><h1>Who did you meet?</h1><p>Keep it lightweight. Context and the next action are more valuable than completing every field.</p></header>
        <div className="field-row two"><TextField label="First name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} error={error} /><TextField label="Last name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></div>
        <div className="field-row two"><TextField label="Email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /><TextField label="Phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
        <div className="field-row two"><TextField label="Role" value={form.role} onChange={(e) => update("role", e.target.value)} /><TextField label="Company" value={form.company} onChange={(e) => update("company", e.target.value)} /></div>
        <div className="context-box"><h3>Remember the meeting</h3><p>These private details never appear on your public card.</p></div>
        <TextAreaField label="What mattered?" hint="Private" value={form.context} onChange={(e) => update("context", e.target.value)} rows={4} placeholder="What did you discuss? What should you remember?" />
        <TextField label="Next action" value={form.nextAction} onChange={(e) => update("nextAction", e.target.value)} placeholder="e.g. Send the research deck on Monday" />
        <div className="form-actions"><LinkButton variant="ghost" href="/app/contacts">Cancel</LinkButton><Button type="submit"><FloppyDiskIcon size={18} weight="bold" />Save and draft follow-up</Button></div>
      </form>
    </AppShell>
  );
}
