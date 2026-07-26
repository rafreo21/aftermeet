import { readContacts, writeContacts, type Contact } from "./contacts";
import { readEncounters, writeEncounter } from "./encounters";
import { queueEncounterSync } from "./encounters-sync";

let hydratePromise: Promise<Contact[]> | null = null;

function contactOnServer(local: Contact, serverContacts: Contact[]) {
  return serverContacts.some((server) =>
    server.id === local.id ||
    (local.exchangeId && server.exchangeId === local.exchangeId),
  );
}

function relinkLocalEncounters(fromContactId: string, toContactId: string) {
  if (!fromContactId || !toContactId || fromContactId === toContactId) return;
  for (const encounter of readEncounters()) {
    if (encounter.contactId !== fromContactId) continue;
    const next = { ...encounter, contactId: toContactId };
    writeEncounter(next);
    queueEncounterSync(next);
  }
}

function replaceLocalContact(previousId: string, nextContact: Contact) {
  const current = readContacts();
  writeContacts([
    nextContact,
    ...current.filter((contact) => contact.id !== previousId && contact.id !== nextContact.id),
  ]);
}

export async function syncContactToServer(contact: Contact) {
  try {
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { contact?: Contact; preview?: boolean };
    if (!payload.contact) return null;
    if (payload.contact.id !== contact.id) {
      replaceLocalContact(contact.id, payload.contact);
      relinkLocalEncounters(contact.id, payload.contact.id);
    }
    return payload.contact;
  } catch {
    return null;
  }
}

export async function hydrateContactsFromServer() {
  if (typeof window === "undefined") return readContacts();
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const response = await fetch("/api/contacts");
      if (!response.ok) return readContacts();

      const payload = await response.json() as { contacts?: Contact[]; preview?: boolean };
      if (payload.preview) return readContacts();

      let serverContacts = payload.contacts ?? [];
      const localContacts = readContacts();

      for (const local of localContacts) {
        if (contactOnServer(local, serverContacts)) continue;
        const synced = await syncContactToServer(local);
        if (synced) {
          serverContacts = [
            synced,
            ...serverContacts.filter((contact) => contact.id !== synced.id),
          ];
        }
      }

      if (serverContacts.length) {
        writeContacts(serverContacts);
        return serverContacts;
      }

      return readContacts();
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export function queueContactSync(contact: Contact) {
  void syncContactToServer(contact);
}
