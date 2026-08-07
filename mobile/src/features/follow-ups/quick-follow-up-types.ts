import type { FollowUpChannel } from '@/features/follow-ups/follow-up-channels';

export type QuickFollowUpItem = {
  id: string;
  title: string;
  channel: FollowUpChannel;
  owner: 'me' | 'guest';
  dueAt: string;
};

export type QuickFollowUpTarget = {
  personName: string;
  personEmail: string;
  sourceId?: string;
  contactId?: string;
  exchangeId?: string;
};
