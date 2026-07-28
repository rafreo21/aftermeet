import { useCallback, useEffect, useState } from 'react';

import type { FollowUpItem } from '@/features/follow-ups/follow-up-api';
import { completeFollowUp } from '@/features/follow-ups/follow-up-api';
import {
  contactContextFromCard,
  contactContextFromFollowUp,
  openFollowUpExecution,
  openRequestEmail,
  planFollowUpExecution,
  sendContactFieldRequest,
  type FollowUpExecution,
} from '@/features/follow-ups/follow-up-executor';
import { fetchConnectedAccounts } from '@/features/follow-ups/integrations-api';
import type { MobileCard } from '@/features/card/types';
import type { ConnectionItem } from '@/features/connections/connections-api';

export function useFollowUpActions(accessToken?: string | null) {
  const [missingExecution, setMissingExecution] = useState<FollowUpExecution | null>(null);
  const [missingOpen, setMissingOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setGoogleConnected(false);
      return;
    }
    void fetchConnectedAccounts(accessToken)
      .then((status) => setGoogleConnected(status.google.connected))
      .catch(() => setGoogleConnected(false));
  }, [accessToken]);

  const runFollowUp = useCallback((
    item: FollowUpItem,
    contextInput?: {
      connection?: ConnectionItem | null;
      card?: MobileCard | null;
    },
  ) => {
    const context = contextInput?.connection
      ? contactContextFromCard(contextInput.connection, contextInput.card ?? null)
      : contactContextFromFollowUp(item);
    context.encounterTitle = item.encounterTitle;

    const execution = planFollowUpExecution(item, context);

    if (execution.type === 'open') {
      void openFollowUpExecution(execution);
      return;
    }

    setMissingExecution(execution);
    setMissingOpen(true);
  }, []);

  const markComplete = useCallback(async (
    item: FollowUpItem,
    onUpdated?: () => void,
  ) => {
    if (!accessToken) return;
    const key = `${item.encounterId}-${item.actionId}`;
    setCompletingId(key);
    try {
      await completeFollowUp(accessToken, item.encounterId, item.actionId);
      onUpdated?.();
    } finally {
      setCompletingId(null);
    }
  }, [accessToken]);

  const closeMissing = useCallback(() => {
    setMissingOpen(false);
    setMissingExecution(null);
  }, []);

  const requestMissingField = useCallback(async () => {
    if (!accessToken || !missingExecution || missingExecution.type !== 'request') return;
    setLoading(true);
    try {
      await sendContactFieldRequest(accessToken, missingExecution);
      closeMissing();
    } finally {
      setLoading(false);
    }
  }, [accessToken, closeMissing, missingExecution]);

  const draftTailoredEmail = useCallback(async (preferGmail: boolean) => {
    if (!missingExecution || missingExecution.type === 'open') return;
    setLoading(true);
    try {
      await openRequestEmail(missingExecution, 'tailored', preferGmail);
      closeMissing();
    } finally {
      setLoading(false);
    }
  }, [closeMissing, missingExecution]);

  const draftPreferredEmail = useCallback(async (preferGmail: boolean) => {
    if (!missingExecution || missingExecution.type === 'open') return;
    setLoading(true);
    try {
      await openRequestEmail(missingExecution, 'preferred', preferGmail);
      closeMissing();
    } finally {
      setLoading(false);
    }
  }, [closeMissing, missingExecution]);

  return {
    runFollowUp,
    markComplete,
    completingId,
    missingOpen,
    missingExecution,
    missingLoading: loading,
    googleConnected,
    closeMissing,
    requestMissingField,
    draftTailoredEmail,
    draftPreferredEmail,
  };
}
