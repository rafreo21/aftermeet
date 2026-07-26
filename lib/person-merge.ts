import type { Contact, ContactSource } from "./contacts";

function preferredContactId(existing: Contact, incoming: Contact) {
  if (existing.exchangeId) return `exchange-${existing.exchangeId}`;
  if (incoming.exchangeId) return `exchange-${incoming.exchangeId}`;
  return existing.id;
}

function mergeField(primary: string | undefined, secondary: string | undefined) {
  return (primary?.trim() || secondary?.trim() || "");
}

export function mergeContacts(existing: Contact, incoming: Contact): Contact {
  const mergedContext = [existing.context, incoming.context]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join("\n\n");

  const sourcePriority: ContactSource[] = ["exchange", "badge", "scan", "linkedin", "vcard", "csv", "manual"];
  const pickSource = () => {
    const existingRank = existing.source ? sourcePriority.indexOf(existing.source) : sourcePriority.length;
    const incomingRank = incoming.source ? sourcePriority.indexOf(incoming.source) : sourcePriority.length;
    if (existingRank === -1 && incomingRank === -1) return existing.source ?? incoming.source;
    if (existingRank === -1) return incoming.source;
    if (incomingRank === -1) return existing.source;
    return existingRank <= incomingRank ? existing.source : incoming.source;
  };

  return {
    id: preferredContactId(existing, incoming),
    firstName: mergeField(existing.firstName, incoming.firstName),
    lastName: mergeField(existing.lastName, incoming.lastName),
    email: mergeField(existing.email, incoming.email),
    phone: mergeField(existing.phone, incoming.phone) || undefined,
    linkedinUrl: mergeField(existing.linkedinUrl, incoming.linkedinUrl) || undefined,
    company: mergeField(existing.company, incoming.company),
    role: mergeField(existing.role, incoming.role),
    context: mergedContext,
    source: pickSource(),
    exchangeId: existing.exchangeId || incoming.exchangeId,
    campaignId: existing.campaignId || incoming.campaignId,
  };
}
