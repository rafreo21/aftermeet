import type { LocalRecordingMetadata } from "./local-recordings";

export type EncounterAction = {
  id: string;
  title: string;
  channel: "email" | "linkedin" | "call" | "meeting" | "send" | "other";
  owner: "me" | "guest";
  dueAt: string;
  status: "open" | "completed" | "snoozed";
};

export type Encounter = {
  id: string;
  title: string;
  personName: string;
  personEmail: string;
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
import type { LocalRecordingMetadata } from "./local-recordings";
