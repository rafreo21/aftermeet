import type { FollowUpItem } from '@/features/follow-ups/follow-up-api';

export type FollowUpGroup = {
  id: string;
  personName: string;
  personEmail: string;
  encounterTitle: string;
  encounterId: string;
  dueAt: string;
  startedAt: string;
  items: FollowUpItem[];
};

function groupKey(item: FollowUpItem) {
  if (item.groupId?.trim()) {
    const person = item.participantId?.trim() || item.personName.trim().toLowerCase();
    return `${item.encounterId}:${item.groupId.trim()}:${person}`;
  }
  return `${item.encounterId}:${item.actionId}`;
}

export function groupFollowUpItems(items: FollowUpItem[]): FollowUpGroup[] {
  const groups = new Map<string, FollowUpGroup>();

  for (const item of items) {
    const key = groupKey(item);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(key, {
      id: key,
      personName: item.personName,
      personEmail: item.personEmail,
      encounterTitle: item.encounterTitle,
      encounterId: item.encounterId,
      dueAt: item.dueAt,
      startedAt: item.startedAt,
      items: [item],
    });
  }

  return Array.from(groups.values());
}
