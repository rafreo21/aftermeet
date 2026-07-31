import type { Encounter, EncounterAction, EncounterParticipant } from "./encounters";

export type FollowUpItem = {
  encounterId: string;
  actionId: string;
  groupId?: string;
  title: string;
  channel: EncounterAction["channel"];
  dueAt: string;
  status: EncounterAction["status"];
  owner: EncounterAction["owner"];
  personName: string;
  personEmail: string;
  participantId?: string;
  participants: EncounterParticipant[];
  contactId?: string;
  exchangeId?: string;
  encounterTitle: string;
  startedAt: string;
};

/**
 * Includes both the host's own actions (owner "me") and actions assigned to
 * the other party (owner "guest") so the host can track — and confirm — the
 * whole meeting's follow-through in one place, not just their own half.
 * Includes completed actions too (bounded by the 250-encounter query limit
 * upstream) — the client buckets open vs. completed into the Current/Past
 * tabs via filterFollowUpsByScope, so this must return both.
 */
export function flattenOpenFollowUps(encounters: Encounter[]): FollowUpItem[] {
  const items: FollowUpItem[] = [];
  for (const encounter of encounters) {
    for (const action of encounter.actions) {
      if (!action.title.trim()) continue;
      items.push({
        encounterId: encounter.id,
        actionId: action.id,
        groupId: action.groupId,
        title: action.title.trim(),
        channel: action.channel,
        dueAt: action.dueAt || "",
        status: action.status,
        owner: action.owner ?? "me",
        personName: action.assigneeName?.trim() || encounter.personName,
        personEmail: action.assigneeEmail?.trim() || encounter.personEmail,
        participantId: action.participantId,
        participants: encounter.participants,
        contactId: encounter.contactId,
        exchangeId: encounter.exchangeId,
        encounterTitle: encounter.title,
        startedAt: encounter.startedAt,
      });
    }
  }
  return items;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  copy.setDate(copy.getDate() + daysUntilSunday);
  return copy;
}

export function dueDateBucket(dueAt: string, now = new Date()): "overdue" | "today" | "week" | "future" | "none" {
  if (!dueAt.trim()) return "none";
  const due = startOfDay(new Date(`${dueAt.slice(0, 10)}T12:00:00`));
  if (Number.isNaN(due.getTime())) return "none";
  const today = startOfDay(now);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  if (due <= endOfWeek(today)) return "week";
  return "future";
}

export function sortFollowUps(items: FollowUpItem[]): FollowUpItem[] {
  const bucketOrder = { overdue: 0, today: 1, week: 2, future: 3, none: 4 } as const;
  return [...items].sort((left, right) => {
    const leftBucket = bucketOrder[dueDateBucket(left.dueAt)];
    const rightBucket = bucketOrder[dueDateBucket(right.dueAt)];
    if (leftBucket !== rightBucket) return leftBucket - rightBucket;

    if (left.dueAt && right.dueAt && left.dueAt !== right.dueAt) {
      return left.dueAt.localeCompare(right.dueAt);
    }

    return right.startedAt.localeCompare(left.startedAt);
  });
}

export function formatDueLabel(dueAt: string, now = new Date()): string | null {
  if (!dueAt.trim()) return null;
  const bucket = dueDateBucket(dueAt, now);
  const due = startOfDay(new Date(`${dueAt.slice(0, 10)}T12:00:00`));
  const today = startOfDay(now);
  if (bucket === "overdue") {
    const days = Math.max(1, Math.round((today.getTime() - due.getTime()) / 86_400_000));
    return days === 1 ? "Overdue 1d" : `Overdue ${days}d`;
  }
  if (bucket === "today") return "Today";
  if (bucket === "week") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (due.getTime() === tomorrow.getTime()) return "Tomorrow";
    return due.toLocaleDateString(undefined, { weekday: "short" });
  }
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function encountersForConnection(
  encounters: Encounter[],
  input: { connectionId?: string; sourceId?: string; email?: string; exchangeId?: string },
): Encounter[] {
  const email = input.email?.trim().toLowerCase() || "";
  const exchangeId = input.exchangeId?.trim() || "";
  const sourceId = input.sourceId?.trim() || "";
  const connectionId = input.connectionId?.trim() || "";

  return encounters.filter((encounter) => {
    if (connectionId && encounter.contactId === connectionId) return true;
    if (sourceId && encounter.contactId === sourceId) return true;
    if (exchangeId && encounter.exchangeId === exchangeId) return true;
    if (email && encounter.personEmail.trim().toLowerCase() === email) return true;
    return false;
  });
}

export function followUpsForConnection(items: FollowUpItem[], input: Parameters<typeof encountersForConnection>[1]) {
  const encounterIds = new Set(encountersForConnection(
    items.map((item) => ({
      id: item.encounterId,
      contactId: item.contactId,
      exchangeId: item.exchangeId,
      personEmail: item.personEmail,
    } as Encounter)),
    input,
  ).map((encounter) => encounter.id));

  return items.filter((item) => encounterIds.has(item.encounterId));
}
