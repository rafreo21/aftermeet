import type { Encounter } from "./encounters";

export type FollowUpTemplate = {
  id: "email_recap" | "send_material" | "schedule_meeting" | "call_back" | "connect_linkedin";
  label: string;
  channel: Encounter["actions"][number]["channel"];
  dueInDays: number;
  buildTitle: (personName: string) => string;
};

function firstName(personName: string, fallback = "them") {
  return personName.trim().split(/\s+/)[0] || fallback;
}

export function followUpDueDate(days: number, now = new Date()) {
  const due = new Date(now);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + days);
  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const day = String(due.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const FOLLOW_UP_TEMPLATES: FollowUpTemplate[] = [
  {
    id: "email_recap",
    label: "Send a recap",
    channel: "email",
    dueInDays: 1,
    buildTitle: (personName) => `Send ${firstName(personName)} a meeting recap`,
  },
  {
    id: "send_material",
    label: "Send something",
    channel: "email",
    dueInDays: 3,
    buildTitle: (personName) => `Send the promised material to ${firstName(personName)}`,
  },
  {
    id: "schedule_meeting",
    label: "Schedule next meeting",
    channel: "meeting",
    dueInDays: 3,
    buildTitle: (personName) => `Schedule the next meeting with ${firstName(personName)}`,
  },
  {
    id: "call_back",
    label: "Call back",
    channel: "call",
    dueInDays: 1,
    buildTitle: (personName) => `Call ${firstName(personName)} back`,
  },
  {
    id: "connect_linkedin",
    label: "Connect on LinkedIn",
    channel: "linkedin",
    dueInDays: 1,
    buildTitle: (personName) => `Connect with ${firstName(personName)} on LinkedIn`,
  },
];
