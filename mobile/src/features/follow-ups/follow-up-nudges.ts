import { dueTone } from '@/lib/due-date';

import type { FollowUpItem } from '@/features/follow-ups/follow-up-api';

export type FollowUpNudgeSummary = {
  overdueCount: number;
  todayCount: number;
  headline: string;
  copy: string;
};

function openFollowUps(items: FollowUpItem[]) {
  return items.filter((item) => item.status !== 'completed');
}

export function summarizeFollowUpNudges(items: FollowUpItem[]): FollowUpNudgeSummary | null {
  const open = openFollowUps(items);
  const overdueCount = open.filter((item) => dueTone(item.dueAt) === 'overdue').length;
  const todayCount = open.filter((item) => dueTone(item.dueAt) === 'today').length;

  if (overdueCount === 0 && todayCount === 0) return null;

  if (overdueCount > 0 && todayCount > 0) {
    return {
      overdueCount,
      todayCount,
      headline: `${overdueCount + todayCount} follow-ups need you`,
      copy: `${overdueCount} overdue and ${todayCount} due today. Tap to take the next step.`,
    };
  }

  if (overdueCount > 0) {
    return {
      overdueCount,
      todayCount,
      headline: overdueCount === 1 ? '1 follow-up is overdue' : `${overdueCount} follow-ups are overdue`,
      copy: 'Send the next message while the meeting is still fresh.',
    };
  }

  return {
    overdueCount,
    todayCount,
    headline: todayCount === 1 ? '1 follow-up due today' : `${todayCount} follow-ups due today`,
    copy: 'A quick note now beats a forgotten promise later.',
  };
}
