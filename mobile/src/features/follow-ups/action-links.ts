import type { EncounterAction } from '@/features/encounters/encounter-api';
import type { ContactMethod } from '@/features/card/types';
import {
  channelToMethodType,
  methodDisplayName,
  resolveMethodHref,
  type MissingMethodType,
} from '@/features/follow-ups/channel-methods';
import { contactMethodHref } from '@/lib/contact-methods';

export type ActionContactContext = {
  personName: string;
  personEmail: string;
  phone?: string;
  methods?: ContactMethod[];
  encounterTitle?: string;
};

export type ResolvedAction = {
  href: string;
  label: string;
  external: boolean;
  unavailableReason?: string;
  missingMethod?: MissingMethodType;
};

function googleCalendarLink(title: string, details: string, dueAt: string) {
  const start = dueAt ? new Date(`${dueAt.slice(0, 10)}T10:00:00`) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details,
    dates: `${format(start)}/${format(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function channelLabel(channel: EncounterAction['channel']) {
  switch (channel) {
    case 'call': return 'Call';
    case 'linkedin': return 'LinkedIn';
    case 'email': return 'Email';
    case 'meeting': return 'Meeting';
    case 'send': return 'Send';
    case 'whatsapp': return 'WhatsApp';
    default: return 'Follow-up';
  }
}

export function resolveFollowUpAction(
  action: Pick<EncounterAction, 'channel' | 'title' | 'dueAt'>,
  context: ActionContactContext,
): ResolvedAction {
  const methods = context.methods ?? [];
  const fallbacks = {
    phone: context.phone,
    email: context.personEmail,
  };
  const methodType = channelToMethodType(action.channel);
  const person = context.personName.trim() || 'This person';
  const methodName = methodDisplayName(methodType);

  if (action.channel === 'meeting') {
    const title = action.title.trim() || `Meeting with ${person}`;
    const details = `Scheduled from AfterMeet${context.encounterTitle ? `: ${context.encounterTitle}` : ''}.`;
    const calendlyHref = resolveMethodHref(methods, 'calendly', fallbacks);
    if (calendlyHref) {
      return { href: calendlyHref, label: 'Book meeting', external: true };
    }
    return {
      href: googleCalendarLink(title, details, action.dueAt),
      label: 'Schedule meeting',
      external: true,
    };
  }

  if (methodType === 'preferred_contact') {
    const anyHref = methods
      .map((method) => contactMethodHref(method))
      .find(Boolean);
    if (anyHref) {
      return { href: anyHref, label: 'Open contact', external: true };
    }
    return {
      href: '',
      label: 'Contact',
      external: false,
      unavailableReason: `${person} hasn't shared a contact method on their card yet.`,
      missingMethod: 'preferred_contact',
    };
  }

  const concreteType = methodType as ContactMethod['type'];
  const href = resolveMethodHref(methods, concreteType, fallbacks);

  if (href) {
    return {
      href,
      label: channelLabel(action.channel),
      external: href.startsWith('http'),
    };
  }

  return {
    href: '',
    label: channelLabel(action.channel),
    external: false,
    unavailableReason: `${person} hasn't added ${methodName} on their card yet.`,
    missingMethod: methodType,
  };
}
