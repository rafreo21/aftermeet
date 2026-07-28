export type DuePreset = 'none' | 'today' | 'tomorrow' | 'week' | 'next_week' | 'custom';

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  copy.setDate(copy.getDate() + daysUntilSunday);
  return copy;
}

export function dueDateFromPreset(preset: DuePreset, customDate = ''): string {
  const now = startOfDay(new Date());
  switch (preset) {
    case 'today':
      return toIsoDate(now);
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return toIsoDate(tomorrow);
    }
    case 'week':
      return toIsoDate(endOfWeek(now));
    case 'next_week': {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return toIsoDate(nextWeek);
    }
    case 'custom':
      return customDate.trim().slice(0, 10);
    default:
      return '';
  }
}

export function inferDuePreset(dueAt: string): DuePreset {
  if (!dueAt.trim()) return 'none';
  const iso = dueAt.trim().slice(0, 10);
  const presets: DuePreset[] = ['today', 'tomorrow', 'week', 'next_week'];
  for (const preset of presets) {
    if (dueDateFromPreset(preset) === iso) return preset;
  }
  return 'custom';
}

export const DUE_PRESETS: Array<{ id: DuePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'This week' },
  { id: 'next_week', label: 'Next week' },
];

export function formatDueLabel(dueAt: string, now = new Date()): string | null {
  if (!dueAt.trim()) return null;
  const due = startOfDay(new Date(`${dueAt.slice(0, 10)}T12:00:00`));
  const today = startOfDay(now);
  if (Number.isNaN(due.getTime())) return null;
  if (due < today) {
    const days = Math.max(1, Math.round((today.getTime() - due.getTime()) / 86_400_000));
    return days === 1 ? 'Overdue 1d' : `Overdue ${days}d`;
  }
  if (due.getTime() === today.getTime()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dueTone(dueAt: string, now = new Date()): 'overdue' | 'today' | 'default' {
  if (!dueAt.trim()) return 'default';
  const due = startOfDay(new Date(`${dueAt.slice(0, 10)}T12:00:00`));
  const today = startOfDay(now);
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'default';
}

export function sortFollowUps<T extends { dueAt: string; startedAt: string }>(items: T[]): T[] {
  const bucket = (dueAt: string) => {
    if (!dueAt.trim()) return 4;
    const due = startOfDay(new Date(`${dueAt.slice(0, 10)}T12:00:00`));
    const today = startOfDay(new Date());
    if (due < today) return 0;
    if (due.getTime() === today.getTime()) return 1;
    if (due <= endOfWeek(today)) return 2;
    return 3;
  };

  return [...items].sort((left, right) => {
    const leftBucket = bucket(left.dueAt);
    const rightBucket = bucket(right.dueAt);
    if (leftBucket !== rightBucket) return leftBucket - rightBucket;
    if (left.dueAt && right.dueAt && left.dueAt !== right.dueAt) {
      return left.dueAt.localeCompare(right.dueAt);
    }
    return right.startedAt.localeCompare(left.startedAt);
  });
}

export function formatMeetingDate(startedAt: string) {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return 'Meeting';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
