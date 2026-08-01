import type { FollowUpChannel } from '@/features/follow-ups/follow-up-channels';
import { dueDateFromPreset } from '@/lib/due-date';

export type FollowUpTemplate = {
  id: 'email_recap' | 'send_material' | 'schedule_meeting' | 'call_back' | 'connect_linkedin';
  label: string;
  channel: FollowUpChannel;
  dueAt: () => string;
  buildTitle: (personName: string) => string;
};

function named(personName: string, fallback: string) {
  const firstName = personName.trim().split(/\s+/)[0];
  return firstName || fallback;
}

export const FOLLOW_UP_TEMPLATES: FollowUpTemplate[] = [
  {
    id: 'email_recap',
    label: 'Send a recap',
    channel: 'email',
    dueAt: () => dueDateFromPreset('tomorrow'),
    buildTitle: (personName) => `Send ${named(personName, 'them')} a meeting recap`,
  },
  {
    id: 'send_material',
    label: 'Send something',
    channel: 'email',
    dueAt: () => dueDateFromPreset('in_3_days'),
    buildTitle: (personName) => `Send the promised material to ${named(personName, 'them')}`,
  },
  {
    id: 'schedule_meeting',
    label: 'Schedule next meeting',
    channel: 'meeting',
    dueAt: () => dueDateFromPreset('in_3_days'),
    buildTitle: (personName) => `Schedule the next meeting with ${named(personName, 'them')}`,
  },
  {
    id: 'call_back',
    label: 'Call back',
    channel: 'call',
    dueAt: () => dueDateFromPreset('tomorrow'),
    buildTitle: (personName) => `Call ${named(personName, 'them')} back`,
  },
  {
    id: 'connect_linkedin',
    label: 'Connect on LinkedIn',
    channel: 'linkedin',
    dueAt: () => dueDateFromPreset('tomorrow'),
    buildTitle: (personName) => `Connect with ${named(personName, 'them')} on LinkedIn`,
  },
];
