import type { LocalRecordingMetadata } from "./local-recordings";

export type EncounterAction = {
  id: string;
  title: string;
  channel: "email" | "linkedin" | "call" | "meeting" | "send" | "whatsapp" | "other";
  owner: "me" | "guest";
  dueAt: string;
  status: "open" | "completed" | "snoozed";
  assigneeName?: string;
  assigneeEmail?: string;
  outboundDraft?: OutboundDraft;
};

export type OutboundDraft = {
  subject: string;
  body: string;
  status: "proposed" | "approved" | "sent" | "dismissed";
  source: "ai" | "heuristic" | "manual";
  generatedAt: string;
  approvedAt?: string;
  sentAt?: string;
};

export type Encounter = {
  id: string;
  title: string;
  personName: string;
  personEmail: string;
  contactId?: string;
  exchangeId?: string;
  campaignId?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  consent: {
    confirmed: boolean;
    method: "verbal" | "written";
    confirmedAt: string;
    scriptVersion: "2026-07-26";
  };
  transcript: string;
  privateNotes: string;
  sharedSummary: string;
  recording?: LocalRecordingMetadata;
  actions: EncounterAction[];
  status: "draft" | "reviewed" | "shared" | "archived";
  shareToken: string;
};

const STORAGE_KEY = "aftermeet-encounters-v1";

export function readEncounters(): Encounter[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Encounter[];
  } catch {
    return [];
  }
}

export function writeEncounter(encounter: Encounter) {
  const current = readEncounters();
  const next = [encounter, ...current.filter((item) => item.id !== encounter.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function writeEncounters(encounters: Encounter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encounters));
}

export function updateEncounter(id: string, update: (encounter: Encounter) => Encounter) {
  const current = readEncounters();
  const next = current.map((item) => (item.id === id ? update(item) : item));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next.find((item) => item.id === id) ?? null;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

type EncounterRow = {
  id: string;
  title: string;
  person_name: string;
  person_email: string;
  contact_id: string | null;
  exchange_id: string | null;
  campaign_id?: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  consent: Encounter["consent"];
  transcript: string;
  private_notes: string;
  shared_summary: string;
  actions: EncounterAction[];
  recording_metadata: LocalRecordingMetadata | null;
  status: Encounter["status"];
  share_token: string;
};

export function encounterFromApi(row: EncounterRow | Record<string, unknown>): Encounter {
  const record = row as EncounterRow;
  return {
    id: String(record.id),
    title: record.title ?? "",
    personName: record.person_name ?? "",
    personEmail: record.person_email ?? "",
    contactId: record.contact_id ?? undefined,
    exchangeId: record.exchange_id ?? undefined,
    campaignId: typeof record.campaign_id === "string" ? record.campaign_id : undefined,
    startedAt: record.started_at,
    endedAt: record.ended_at,
    durationSeconds: record.duration_seconds ?? 0,
    consent: record.consent,
    transcript: record.transcript ?? "",
    privateNotes: record.private_notes ?? "",
    sharedSummary: record.shared_summary ?? "",
    recording: record.recording_metadata ?? undefined,
    actions: Array.isArray(record.actions) ? record.actions : [],
    status: record.status ?? "draft",
    shareToken: record.share_token,
  };
}

export function encounterFromSharedPayload(payload: Record<string, unknown>): Encounter | null {
  if (!payload || typeof payload.id !== "string") return null;
  return {
    id: payload.id,
    title: String(payload.title ?? ""),
    personName: String(payload.personName ?? ""),
    personEmail: String(payload.personEmail ?? ""),
    contactId: typeof payload.contactId === "string" ? payload.contactId : undefined,
    exchangeId: typeof payload.exchangeId === "string" ? payload.exchangeId : undefined,
    campaignId: typeof payload.campaignId === "string" ? payload.campaignId : undefined,
    startedAt: String(payload.startedAt ?? new Date().toISOString()),
    endedAt: String(payload.endedAt ?? new Date().toISOString()),
    durationSeconds: typeof payload.durationSeconds === "number" ? payload.durationSeconds : 0,
    consent: payload.consent as Encounter["consent"],
    transcript: String(payload.transcript ?? ""),
    privateNotes: String(payload.privateNotes ?? ""),
    sharedSummary: String(payload.sharedSummary ?? ""),
    recording: payload.recording && typeof payload.recording === "object"
      ? {
          id: String(payload.id),
          durationSeconds: typeof (payload.recording as Record<string, unknown>).durationSeconds === "number"
            ? (payload.recording as Record<string, unknown>).durationSeconds as number
            : 0,
          fileSize: 0,
          mimeType: String((payload.recording as Record<string, unknown>).mimeType ?? "audio/mp4"),
          source: "recorded",
          retention: "never",
          expiresAt: null,
          createdAt: String(payload.startedAt ?? new Date().toISOString()),
          sharedAudioUrl: String((payload.recording as Record<string, unknown>).sharedAudioUrl ?? ""),
        }
      : undefined,
    actions: Array.isArray(payload.actions) ? payload.actions as EncounterAction[] : [],
    status: "shared",
    shareToken: String(payload.shareToken ?? ""),
  };
}

export function encounterToApiBody(encounter: Encounter) {
  return {
    id: encounter.id,
    title: encounter.title,
    personName: encounter.personName,
    personEmail: encounter.personEmail,
    contactId: encounter.contactId ?? null,
    exchangeId: encounter.exchangeId ?? null,
    campaignId: encounter.campaignId ?? null,
    startedAt: encounter.startedAt,
    endedAt: encounter.endedAt,
    durationSeconds: encounter.durationSeconds,
    consent: encounter.consent,
    transcript: encounter.transcript,
    privateNotes: encounter.privateNotes,
    sharedSummary: encounter.sharedSummary,
    actions: encounter.actions,
    recording: encounter.recording,
    status: encounter.status,
    shareToken: encounter.shareToken,
  };
}
