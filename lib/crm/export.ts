import type { Contact } from "../contacts";
import type { Encounter } from "../encounters";

export type CrmExportBundle = {
  exportedAt: string;
  version: 1;
  contacts: Contact[];
  encounters: Encounter[];
};

export function buildCrmExportBundle(contacts: Contact[], encounters: Encounter[]): CrmExportBundle {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    contacts,
    encounters,
  };
}

export function buildCrmExportCsv(contacts: Contact[]) {
  const headers = ["firstName", "lastName", "email", "phone", "company", "role", "linkedinUrl", "context", "source"];
  const rows = contacts.map((contact) => [
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone ?? "",
    contact.company,
    contact.role,
    contact.linkedinUrl ?? "",
    contact.context.replace(/\n/g, " "),
    contact.source ?? "",
  ]);
  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function activationMetrics(contacts: Contact[], encounters: Encounter[]) {
  const openFollowUps = encounters.flatMap((encounter) =>
    encounter.actions.filter((action) => action.owner === "me" && action.status !== "completed"),
  );
  const completedFollowUps = encounters.flatMap((encounter) =>
    encounter.actions.filter((action) => action.owner === "me" && action.status === "completed"),
  );

  return {
    contacts: contacts.length,
    encounters: encounters.length,
    openFollowUps: openFollowUps.length,
    completedFollowUps: completedFollowUps.length,
  };
}
