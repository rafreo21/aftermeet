"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { FileArrowUpIcon } from "@phosphor-icons/react/dist/csr/FileArrowUp";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../../components/AppShell";
import { PageSkeleton, StatusMessage } from "../../components/AsyncState";
import { Button, LinkButton } from "../../components/Button";
import { TextField } from "../../components/FormField";
import { contactFromExchange, readContacts } from "../../../lib/contacts";
import { resolveAndSaveContact } from "../../../lib/person-links";
import { hydrateContactsFromServer } from "../../../lib/contacts-sync";
import "../product.css";
import "../flow.css";

type Contact = { id: string; firstName: string; lastName: string; email: string; company: string; role: string; context: string; source?: "csv" | "vcard" | "manual" | "exchange" | "badge" | "linkedin" | "scan" };

function contactSourceLabel(source?: Contact["source"]) {
  switch (source) {
    case "exchange": return "Shared from your card";
    case "vcard": return "vCard import";
    case "badge": return "Badge scan";
    case "linkedin": return "LinkedIn";
    case "scan": return "QR scan";
    case "csv": return "CSV import";
    case "manual": return "Manual add";
    default: return "";
  }
}

type CardExchange = {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone?: string;
  visitor_company: string;
  visitor_role: string;
  note: string;
  created_at: string;
  cards?: { full_name?: string; slug?: string } | { full_name?: string; slug?: string }[] | null;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || "Guest", lastName: parts.slice(1).join(" ") };
}

function cardLabel(exchange: CardExchange) {
  const card = Array.isArray(exchange.cards) ? exchange.cards[0] : exchange.cards;
  return card?.full_name || "your card";
}

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
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [exchanges, setExchanges] = useState<CardExchange[]>([]);
  const [exchangeError, setExchangeError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void hydrateContactsFromServer()
      .then((next) => setContacts(next))
      .catch(() => {
        try { setContacts(JSON.parse(localStorage.getItem("aftermeet-contacts-v1") || "[]")); }
        catch { setImportError("We couldn’t load your saved contacts. Refresh the page to try again."); }
      })
      .finally(() => { setHydrated(true); });
  }, []);
  useEffect(() => {
    void fetch("/api/cards/exchanges")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as { exchanges?: CardExchange[] };
        setExchanges(payload.exchanges ?? []);
      })
      .catch(() => setExchangeError("We couldn’t load people who shared back from your card."));
  }, []);
  const visible = useMemo(() => contacts.filter((contact) => `${contact.firstName} ${contact.lastName} ${contact.company}`.toLowerCase().includes(query.toLowerCase())), [contacts, query]);

  async function importExchange(exchange: CardExchange) {
    resolveAndSaveContact(contactFromExchange(exchange, cardLabel(exchange)));
    setContacts(readContacts());
    const response = await fetch("/api/cards/exchanges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: exchange.id, status: "imported" }),
    });
    if (response.ok) {
      setExchanges((current) => current.filter((item) => item.id !== exchange.id));
      setImportMessage(`${exchange.visitor_name} added from your public card.`);
    }
  }

  async function dismissExchange(id: string) {
    const response = await fetch("/api/cards/exchanges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    if (response.ok) setExchanges((current) => current.filter((item) => item.id !== id));
  }

  async function importContacts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage("");
    setImportError("");
    try {
      const text = await file.text();
      const imported = file.name.toLowerCase().endsWith(".vcf") ? parseVcard(text) : parseCsv(text);
      if (!imported.length) {
        setImportError("No contacts were found. Check that the file is a valid CSV or vCard and try again.");
        return;
      }
      const existingKeys = new Set(contacts.map((contact) => `${contact.email.toLowerCase()}|${contact.firstName.toLowerCase()}|${contact.lastName.toLowerCase()}`));
      const unique = imported.filter((contact) => !existingKeys.has(`${contact.email.toLowerCase()}|${contact.firstName.toLowerCase()}|${contact.lastName.toLowerCase()}`));
      for (const contact of unique) resolveAndSaveContact(contact);
      setContacts(readContacts());
      setImportMessage(`${unique.length} contact${unique.length === 1 ? "" : "s"} imported${unique.length < imported.length ? ` · ${imported.length - unique.length} duplicate${imported.length - unique.length === 1 ? "" : "s"} skipped` : ""}.`);
    } catch {
      setImportError("We couldn’t read that file. Try exporting it again as CSV or vCard.");
    } finally {
      event.target.value = "";
      setImporting(false);
    }
  }

  const importButton = <Button variant="secondary" loading={importing} onClick={() => importInput.current?.click()}><FileArrowUpIcon size={17} weight="bold" />{importing ? "Importing…" : "Import contacts"}</Button>;
  const captureButtons = <>
    <LinkButton variant="secondary" href="/app/scan"><QrCodeIcon size={17} weight="bold" />Scan badge</LinkButton>
    <LinkButton variant="secondary" href="/app/contacts/linkedin"><LinkedinLogoIcon size={17} weight="bold" />LinkedIn</LinkButton>
  </>;

  return (
    <AppShell active="contacts" title="Contacts" subtitle="People, meetings, and the context that makes follow-up personal." actions={<LinkButton size="small" variant="ghost" href="/app/activate">Activate data</LinkButton>}>
      <div className="flow-page">
        <input ref={importInput} className="sr-only" type="file" accept=".csv,.vcf,text/csv,text/vcard" onChange={importContacts} />
        <div className="flow-heading"><div><h1>People you’ve met.</h1><p>A useful contact record remembers more than a name and email.</p></div></div>
        {importMessage && <StatusMessage tone="success">{importMessage}</StatusMessage>}
        {importError && <StatusMessage tone="error" action={<Button size="small" variant="ghost" onClick={() => setImportError("")}>Dismiss</Button>}>{importError}</StatusMessage>}
        {exchangeError && <StatusMessage tone="error">{exchangeError}</StatusMessage>}
        {hydrated && exchanges.length ? (
          <section className="inbound-captures">
            <div className="inbound-captures-head">
              <h2>Shared back from your card</h2>
              <p>{exchanges.length} new {exchanges.length === 1 ? "person" : "people"} sent their details from a public card.</p>
            </div>
            <div className="inbound-capture-list">
              {exchanges.map((exchange) => (
                <article className="inbound-capture-row" key={exchange.id}>
                  <div>
                    <h3>{exchange.visitor_name}</h3>
                    <p>{[exchange.visitor_role, exchange.visitor_company].filter(Boolean).join(" · ") || exchange.visitor_email || "No company listed"}</p>
                    {exchange.note ? <small>{exchange.note}</small> : null}
                    <small className="contact-source">From {cardLabel(exchange)}</small>
                  </div>
                  <div className="inbound-capture-actions">
                    <Button size="small" onClick={() => void importExchange(exchange)}>Add contact</Button>
                    <Button size="small" variant="ghost" onClick={() => void dismissExchange(exchange.id)}>Dismiss</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {!hydrated ? <PageSkeleton rows={3} /> : contacts.length ? <><div className="contact-toolbar"><div className="contact-search"><TextField label="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} leadingIcon={<MagnifyingGlassIcon size={18} />} /></div><div className="contact-toolbar-actions">{captureButtons}{importButton}<LinkButton href="/app/contacts/new"><PlusIcon size={17} weight="bold" />Add person</LinkButton></div></div>{visible.length ? <div className="contact-list">{visible.map((contact) => <article className="contact-row" key={contact.id}><span className="contact-avatar">{contact.firstName[0]}{contact.lastName[0]}</span><div><h3>{contact.firstName} {contact.lastName}</h3><p>{contact.role}{contact.company ? ` · ${contact.company}` : ""}</p>{contact.source && <small className="contact-source">{contactSourceLabel(contact.source)}</small>}</div><div className="contact-row-actions"><LinkButton size="small" variant="secondary" href={`/app/contacts/${contact.id}`}>Open</LinkButton><LinkButton size="small" variant="ghost" href="/app/followups">Follow-up</LinkButton></div></article>)}</div> : <div className="empty-state"><div><h2>No matching people</h2><p>Try a different name or company.</p><Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button></div></div>}</> : <div className="empty-state"><div><span className="empty-icon"><UsersThreeIcon size={32} weight="bold" /></span><h2>No contacts yet</h2><p>Add someone you’ve met, scan a badge, import a file, or publish a card so people can share their details back.</p><div className="empty-state-actions"><LinkButton href="/app/contacts/new"><PlusIcon size={17} weight="bold" />Add person</LinkButton><LinkButton href="/app/scan"><QrCodeIcon size={17} weight="bold" />Scan badge</LinkButton><LinkButton href="/app/contacts/linkedin"><LinkedinLogoIcon size={17} weight="bold" />LinkedIn</LinkButton>{importButton}</div></div></div>}
      </div>
    </AppShell>
  );
}
