import {
  findContactByCardSlug,
  findContactByEmail,
  findContactByExchangeId,
  findContactById,
  findContactByPersonName,
  normalizeEmail,
  normalizePersonName,
  readContacts,
  writeContacts,
  type Contact,
} from "./contacts";
import { readEncounters, writeEncounter, type Encounter } from "./encounters";
import { queueEncounterSync } from "./encounters-sync";
import { mergeContacts } from "./person-merge";
import { queueContactSync } from "./contacts-sync";

export { mergeContacts } from "./person-merge";

export function resolveAndSaveContact(candidate: Contact): Contact {
  let match =
    (candidate.exchangeId ? findContactByExchangeId(candidate.exchangeId) : null) ??
    (candidate.email ? findContactByEmail(candidate.email) : null) ??
    findContactById(candidate.id) ??
    findContactByPersonName(candidate.firstName, candidate.lastName);

  if (candidate.id.startsWith("card-")) {
    match = match ?? findContactByCardSlug(candidate.id.replace(/^card-/, ""));
  }

  if (!match) {
    writeContacts([candidate, ...readContacts().filter((item) => item.id !== candidate.id)]);
    linkEncountersToContact(candidate);
    queueContactSync(candidate);
    return candidate;
  }

  const merged = mergeContacts(match, candidate);
  const removedIds = new Set([candidate.id, match.id].filter((id) => id !== merged.id));
  writeContacts([merged, ...readContacts().filter((item) => !removedIds.has(item.id) && item.id !== merged.id)]);

  for (const oldId of removedIds) relinkEncounterContactIds(oldId, merged.id);
  linkEncountersToContact(merged);
  queueContactSync(merged);
  return merged;
}

export function upsertContact(contact: Contact) {
  return resolveAndSaveContact(contact);
}

function personNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function relinkEncounterContactIds(fromContactId: string, toContactId: string) {
  if (!fromContactId || !toContactId || fromContactId === toContactId) return;
  for (const encounter of readEncounters()) {
    if (encounter.contactId !== fromContactId) continue;
    const next = { ...encounter, contactId: toContactId };
    writeEncounter(next);
    queueEncounterSync(next);
  }
}

export function linkEncountersToContact(contact: Contact) {
  const nameKey = normalizePersonName(contact.firstName, contact.lastName);
  const email = normalizeEmail(contact.email);
  const linked: Encounter[] = [];

  for (const encounter of readEncounters()) {
    const matchesExchange = Boolean(contact.exchangeId && encounter.exchangeId === contact.exchangeId);
    const matchesContact = encounter.contactId === contact.id;
    const matchesName =
      !encounter.contactId &&
      !encounter.exchangeId &&
      personNameKey(encounter.personName) === nameKey;
    const matchesEmail =
      !encounter.contactId &&
      Boolean(email) &&
      normalizeEmail(encounter.personEmail) === email;

    if (!matchesExchange && !matchesContact && !matchesName && !matchesEmail) continue;

    const next: Encounter = {
      ...encounter,
      contactId: contact.id,
      exchangeId: contact.exchangeId || encounter.exchangeId,
      personEmail: encounter.personEmail || contact.email,
    };

    if (
      next.contactId !== encounter.contactId ||
      next.exchangeId !== encounter.exchangeId ||
      next.personEmail !== encounter.personEmail
    ) {
      writeEncounter(next);
      queueEncounterSync(next);
    }
    linked.push(next);
  }

  return linked;
}

export function encountersForContact(contact: Contact) {
  const nameKey = normalizePersonName(contact.firstName, contact.lastName);
  return readEncounters().filter((encounter) =>
    encounter.contactId === contact.id ||
    (contact.exchangeId && encounter.exchangeId === contact.exchangeId) ||
    (!encounter.contactId && personNameKey(encounter.personName) === nameKey),
  );
}
