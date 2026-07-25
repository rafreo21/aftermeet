"use client";

import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../../components/AppShell";
import { LinkButton } from "../../components/Button";
import { TextField } from "../../components/FormField";
import "../product.css";
import "../flow.css";

type Contact = { id: string; firstName: string; lastName: string; email: string; company: string; role: string; context: string };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => { try { setContacts(JSON.parse(localStorage.getItem("aftermeet-contacts-v1") || "[]")); } catch {} }, []);
  const visible = useMemo(() => contacts.filter((contact) => `${contact.firstName} ${contact.lastName} ${contact.company}`.toLowerCase().includes(query.toLowerCase())), [contacts, query]);

  return (
    <AppShell active="contacts" title="Contacts" subtitle="People, meetings, and the context that makes follow-up personal." actions={<LinkButton size="small" href="/app/contacts/new"><PlusIcon size={16} weight="bold" />New contact</LinkButton>}>
      <div className="flow-page">
        <div className="flow-heading"><div><h1>People you’ve met.</h1><p>A useful contact record remembers more than a name and email.</p></div></div>
        {contacts.length ? <><div className="contact-toolbar"><div className="contact-search"><TextField label="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} leadingIcon={<MagnifyingGlassIcon size={18} />} /></div><LinkButton href="/app/contacts/new"><PlusIcon size={17} weight="bold" />Add contact</LinkButton></div><div className="contact-list">{visible.map((contact) => <article className="contact-row" key={contact.id}><span className="contact-avatar">{contact.firstName[0]}{contact.lastName[0]}</span><div><h3>{contact.firstName} {contact.lastName}</h3><p>{contact.role}{contact.company ? ` · ${contact.company}` : ""}</p></div><LinkButton size="small" variant="secondary" href="/app/followups">Create follow-up</LinkButton></article>)}</div></> : <div className="empty-state"><div><span className="empty-icon"><UsersThreeIcon size={32} weight="bold" /></span><h2>No contacts yet</h2><p>Add the first person you met, including the context you’ll need for a thoughtful follow-up.</p><LinkButton href="/app/contacts/new"><PlusIcon size={17} weight="bold" />Create first contact</LinkButton></div></div>}
      </div>
    </AppShell>
  );
}
