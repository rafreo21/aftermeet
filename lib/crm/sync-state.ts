export type CrmSyncRecord = {
  provider: "hubspot";
  externalId: string;
  syncedAt: string;
};

export const CRM_SYNC_STORAGE_KEY = "aftermeet-crm-sync-v1";

export function readCrmSyncMap(): Record<string, CrmSyncRecord> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CRM_SYNC_STORAGE_KEY) || "{}") as Record<string, CrmSyncRecord>;
  } catch {
    return {};
  }
}

export function writeCrmSyncRecord(contactId: string, record: CrmSyncRecord) {
  const current = readCrmSyncMap();
  localStorage.setItem(CRM_SYNC_STORAGE_KEY, JSON.stringify({ ...current, [contactId]: record }));
}

export function crmSyncRecordForContact(contactId: string) {
  return readCrmSyncMap()[contactId] ?? null;
}
