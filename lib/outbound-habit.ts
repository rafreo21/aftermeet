export type OutboundHabit = {
  completedActions: number;
  approvedDrafts: number;
  sentDrafts: number;
};

export const OUTBOUND_HABIT_STORAGE_KEY = "aftermeet-outbound-habit-v1";
const HABIT_THRESHOLD = { sentDrafts: 2, completedActions: 3 };

function readHabit(): OutboundHabit {
  if (typeof window === "undefined") {
    return { completedActions: 0, approvedDrafts: 0, sentDrafts: 0 };
  }
  try {
    return JSON.parse(localStorage.getItem(OUTBOUND_HABIT_STORAGE_KEY) || "{}") as OutboundHabit;
  } catch {
    return { completedActions: 0, approvedDrafts: 0, sentDrafts: 0 };
  }
}

function writeHabit(habit: OutboundHabit) {
  localStorage.setItem(OUTBOUND_HABIT_STORAGE_KEY, JSON.stringify(habit));
}

export function readOutboundHabit() {
  const habit = readHabit();
  return {
    ...habit,
    completedActions: habit.completedActions ?? 0,
    approvedDrafts: habit.approvedDrafts ?? 0,
    sentDrafts: habit.sentDrafts ?? 0,
  };
}

export function recordCompletedAction() {
  const habit = readOutboundHabit();
  writeHabit({ ...habit, completedActions: habit.completedActions + 1 });
}

export function recordApprovedDraft() {
  const habit = readOutboundHabit();
  writeHabit({ ...habit, approvedDrafts: habit.approvedDrafts + 1 });
}

export function recordSentDraft() {
  const habit = readOutboundHabit();
  writeHabit({ ...habit, sentDrafts: habit.sentDrafts + 1 });
}

export function isOutboundHabitProven() {
  const habit = readOutboundHabit();
  return habit.sentDrafts >= HABIT_THRESHOLD.sentDrafts
    || habit.completedActions >= HABIT_THRESHOLD.completedActions;
}

export function outboundHabitRequirement() {
  return HABIT_THRESHOLD;
}

export function supportsOutboundDraft(channel: string) {
  return channel === "email" || channel === "send" || channel === "linkedin";
}
