"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { FileArrowUpIcon } from "@phosphor-icons/react/dist/csr/FileArrowUp";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../../components/AppShell";
import { Button, LinkButton } from "../../components/Button";
import { TextField } from "../../components/FormField";
import "../product.css";
import "../flow.css";

type Contact = { id: string; firstName: string; lastName: string; email: string; company: string; role: string; context: string; source?: "csv" | "vcard" | "manual" };

function parseCsv(text: string): Contact[] {
  const rows = text.trim().split(/\r?\n/).map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  const headers = rows.shift()?.map((header) => header.toLowerCase()) ?? [];
  const value = (row: string[], names: string[]) => row[headers.findIndex((header) => names.includes(header))] || "";
  return rows.map((row, index) => ({
    id: `csv-${Date.now()}-${index}`,
    firstName: value(row, ["first name", "firstname", "given name"]),
    lastName: value(row, ["last name", "lastname", "family name"]),
    email: value(row, ["email", "email address", "e-mail address"]),
    company: value(row, ["company", "organization", "organisation"]),
    role: value(row, ["role", "job title", "title"]),
    context: "",
    source: "csv",
  })).filter((contact) => contact.firstName || contact.lastName || contact.email);
}

function parseVcard(text: string): Contact[] {
  return text.split(/END:VCARD/i).map((card, index) => {
    const field = (name: string) => card.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im"))?.[1]?.trim() || "";
    const [lastName = "", firstName = ""] = field("N").split(";");
    return {
      id: `vcard-${Date.now()}-${index}`,
      firstName: firstName || field("FN").split(" ")[0] || "",
      lastName: lastName || field("FN").split(" ").slice(1).join(" "),
      email: field("EMAIL"),
      company: field("ORG").replace(/;/g, " "),
      role: field("TITLE"),
      context: "",
      source: "vcard" as const,
    };
  }).filter((contact) => contact.firstName || contact.lastName || contact.email);
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => { try { setContacts(JSON.parse(localStorage.getItem("aftermeet-contacts-v1") || "[]")); } catch {} }, []);
  const visible = useMemo(() => contacts.filter((contact) => `${contact.firstName} ${contact.lastName} ${contact.company}`.toLowerCase().includes(query.toLowerCase())), [contacts, query]);

  async function importContacts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = file.name.toLowerCase().endsWith(".vcf") ? parseVcard(text) : parseCsv(text);
    if (!imported.length) {
      setImportMessage("No contacts were found. Try a CSV or vCard file.");
      event.target.value = "";
      return;
    }
    const existingKeys = new Set(contacts.map((contact) => `${contact.email.toLowerCase()}|${contact.firstName.toLowerCase()}|${contact.lastName.toLowerCase()}`));
    const unique = imported.filter((contact) => !existingKeys.has(`${contact.email.toLowerCase()}|${contact.firstName.toLowerCase()}|${contact.lastName.toLowerCase()}`));
    const next = [...contacts, ...unique];
    setContacts(next);
    localStorage.setItem("aftermeet-contacts-v1", JSON.stringify(next));
    setImportMessage(`${unique.length} contact${unique.length === 1 ? "" : "s"} imported${unique.length < imported.length ? ` · ${imported.length - unique.length} duplicate${imported.length - unique.length === 1 ? "" : "s"} skipped` : ""}.`);
    event.target.value = "";
  }

  const importButton = <Button variant="secondary" onClick={() => importInput.current?.click()}><FileArrowUpIcon size={17} weight="bold" />Import contacts</Button>;

  return (
    <AppShell active="contacts" title="Contacts" subtitle="People, meetings, and the context that makes follow-up personal.">
      <div className="flow-page">
        <input ref={importInput} className="sr-only" type="file" accept=".csv,.vcf,text/csv,text/vcard" onChange={importContacts} />
        <div className="flow-heading"><div><h1>People you’ve met.</h1><p>A useful contact record remembers more than a name and email.</p></div></div>
        {importMessage && <p className="contact-import-message" role="status">{importMessage}</p>}
        {contacts.length ? <><div className="contact-toolbar"><div className="contact-search"><TextField label="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} leadingIcon={<MagnifyingGlassIcon size={18} />} /></div><div className="contact-toolbar-actions">{importButton}<LinkButton href="/app/contacts/new"><PlusIcon size={17} weight="bold" />Add person</LinkButton></div></div><div className="contact-list">{visible.map((contact) => <article className="contact-row" key={contact.id}><span className="contact-avatar">{contact.firstName[0]}{contact.lastName[0]}</span><div><h3>{contact.firstName} {contact.lastName}</h3><p>{contact.role}{contact.company ? ` · ${contact.company}` : ""}</p>{contact.source && <small className="contact-source">{contact.source === "vcard" ? "vCard import" : `${contact.source.toUpperCase()} import`}</small>}</div><LinkButton size="small" variant="secondary" href="/app/followups">Create follow-up</LinkButton></article>)}</div></> : <div className="empty-state"><div><span className="empty-icon"><UsersThreeIcon size={32} weight="bold" /></span><h2>No contacts yet</h2><p>Add someone you’ve met or bring in existing contacts from a CSV or vCard file.</p><div className="empty-state-actions"><LinkButton href="/app/contacts/new"><PlusIcon size={17} weight="bold" />Add person</LinkButton>{importButton}</div></div></div>}
      </div>
    </AppShell>
  );
}
