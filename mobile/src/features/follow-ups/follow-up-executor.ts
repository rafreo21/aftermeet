import { Linking } from 'react-native';

import type { FollowUpItem } from '@/features/follow-ups/follow-up-api';
import { requestContactField } from '@/features/follow-ups/follow-up-api';
import { resolveFollowUpAction, type ActionContactContext } from '@/features/follow-ups/action-links';
import {
  buildTailoredRequestEmail,
  requestEmailSubject,
  type MissingMethodType,
} from '@/features/follow-ups/channel-methods';
import { openEmailCompose } from '@/lib/email-compose';
import type { MobileCard } from '@/features/card/types';
import type { ConnectionItem } from '@/features/connections/connections-api';

export function contactContextFromCard(
  connection: Pick<ConnectionItem, 'name' | 'email' | 'phone'>,
  card: MobileCard | null,
): ActionContactContext {
  const methods = card?.methods ?? [];
  const phone = connection.phone?.trim()
    || methods.find((method) => method.type === 'phone')?.value?.trim()
    || '';

  return {
    personName: connection.name,
    personEmail: connection.email?.trim()
      || methods.find((method) => method.type === 'email')?.value?.trim()
      || '',
    phone,
    methods,
  };
}

export function contactContextFromFollowUp(item: FollowUpItem): ActionContactContext {
  return {
    personName: item.personName,
    personEmail: item.personEmail,
    methods: [],
    encounterTitle: item.encounterTitle,
  };
}

export type FollowUpExecution =
  | { type: 'open'; href: string; external: boolean }
  | {
      type: 'request';
      item: FollowUpItem;
      methodType: MissingMethodType;
      message: string;
      recipientEmail: string;
      emailSubject: string;
      tailoredEmailBody: string;
      preferredContactEmailBody: string;
    }
  | {
      type: 'manual';
      message: string;
      recipientEmail?: string;
      emailSubject?: string;
      tailoredEmailBody?: string;
      preferredContactEmailBody?: string;
    };

export function planFollowUpExecution(
  item: FollowUpItem,
  context: ActionContactContext,
): FollowUpExecution {
  const action = resolveFollowUpAction(
    { channel: item.channel, title: item.title, dueAt: item.dueAt },
    { ...context, encounterTitle: item.encounterTitle },
  );

  if (action.href && !action.missingMethod) {
    return { type: 'open', href: action.href, external: action.external };
  }

  const methodType = action.missingMethod || 'preferred_contact';
  const message = action.unavailableReason
    || `${context.personName || 'This person'} hasn't added that contact method yet.`;
  const recipientEmail = context.personEmail.trim();
  const emailSubject = requestEmailSubject(methodType);
  const tailoredEmailBody = buildTailoredRequestEmail({
    personName: context.personName,
    methodType,
    followUpTitle: item.title,
  });
  const preferredContactEmailBody = buildTailoredRequestEmail({
    personName: context.personName,
    methodType: 'preferred_contact',
    followUpTitle: item.title,
  });

  if (recipientEmail.includes('@')) {
    return {
      type: 'request',
      item,
      methodType,
      message,
      recipientEmail,
      emailSubject,
      tailoredEmailBody,
      preferredContactEmailBody,
    };
  }

  return {
    type: 'manual',
    message: `${message} We don't have their email yet, so you'll need to reach out another way.`,
  };
}

export async function openFollowUpExecution(execution: FollowUpExecution) {
  if (execution.type !== 'open') return;
  await Linking.openURL(execution.href);
}

export async function sendContactFieldRequest(
  accessToken: string,
  execution: Extract<FollowUpExecution, { type: 'request' }>,
) {
  await requestContactField(accessToken, {
    targetEmail: execution.recipientEmail,
    targetExchangeId: execution.item.exchangeId,
    fieldType: execution.methodType,
    channel: execution.item.channel,
    followUpTitle: execution.item.title,
    encounterId: execution.item.encounterId,
    actionId: execution.item.actionId,
  });
}

export async function openRequestEmail(
  execution: Extract<FollowUpExecution, { type: 'request' | 'manual' }>,
  variant: 'tailored' | 'preferred',
  preferGmail: boolean,
) {
  const recipientEmail = execution.recipientEmail?.trim() || '';
  const body = variant === 'preferred'
    ? execution.preferredContactEmailBody
    : execution.tailoredEmailBody;
  const subject = execution.emailSubject || requestEmailSubject('preferred_contact');

  if (!recipientEmail.includes('@') || !body) return;

  await openEmailCompose({
    to: recipientEmail,
    subject,
    body,
  }, preferGmail);
}
