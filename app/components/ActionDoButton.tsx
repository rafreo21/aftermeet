"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import type { ActionLinkContext } from "../../lib/action-links";
import { resolveActionLink, resolveSecondaryActionLinks } from "../../lib/action-links";
import type { EncounterAction } from "../../lib/encounters";
import { emptyConnectedAccountStatus, type ConnectedAccountStatus } from "../../lib/integrations/types";
import { Button, LinkButton } from "./Button";

type ActionDoButtonProps = {
  action: Pick<EncounterAction, "channel" | "title" | "dueAt" | "status" | "owner">;
  context: ActionLinkContext;
  size?: "small" | "medium";
  showSecondary?: boolean;
};

export function ActionDoButton({ action, context, size = "small", showSecondary = false }: ActionDoButtonProps) {
  const [integrations, setIntegrations] = useState<ConnectedAccountStatus>(emptyConnectedAccountStatus());
  const [scheduling, setScheduling] = useState<"" | "google" | "microsoft">("");
  const [scheduleMessage, setScheduleMessage] = useState("");

  useEffect(() => {
    void fetch("/api/integrations/status")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as { status?: ConnectedAccountStatus };
        if (payload.status) setIntegrations(payload.status);
      })
      .catch(() => undefined);
  }, []);

  if (action.owner !== "me" || action.status === "completed") return null;

  const primary = resolveActionLink(action, context);
  const secondary = (showSecondary ? resolveSecondaryActionLinks(action, context) : []).filter((link) => {
    if (action.channel !== "meeting") return true;
    if (integrations.google.connected && link.label === "Schedule in Google Calendar") return false;
    if (integrations.microsoft.connected && link.label === "Outlook Calendar") return false;
    return true;
  });
  const buttonSize = size === "medium" ? "normal" : "small";

  async function scheduleViaConnected(provider: "google" | "microsoft") {
    const title = action.title.trim() || `Meeting with ${context.personName || "contact"}`;
    const details = `Scheduled from AfterMeet${context.encounterTitle ? `: ${context.encounterTitle}` : ""}.`;
    setScheduling(provider);
    setScheduleMessage("");
    try {
      const response = await fetch("/api/integrations/schedule-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, title, details, dueAt: action.dueAt }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setScheduleMessage(payload.error || "We couldn’t schedule this meeting.");
        return;
      }
      setScheduleMessage(`Scheduled in ${provider === "google" ? "Google Calendar" : "Outlook Calendar"}.`);
    } catch {
      setScheduleMessage("We couldn’t schedule this meeting.");
    } finally {
      setScheduling("");
    }
  }

  if (primary.unavailableReason) {
    return <span className="action-do-unavailable" title={primary.unavailableReason}>{primary.label} unavailable</span>;
  }

  return (
    <div className="action-do-group">
      {action.channel === "meeting" && integrations.google.connected ? (
        <Button size={buttonSize} loading={scheduling === "google"} onClick={() => void scheduleViaConnected("google")}>
          <CalendarBlankIcon size={14} weight="bold" />Schedule in Google Calendar
        </Button>
      ) : (
        <LinkButton
          size={buttonSize}
          href={primary.href}
          target={primary.external ? "_blank" : undefined}
          rel={primary.external ? "noreferrer" : undefined}
        >
          {primary.label}
          {primary.external ? <ArrowSquareOutIcon size={14} weight="bold" /> : null}
        </LinkButton>
      )}
      {action.channel === "meeting" && integrations.microsoft.connected ? (
        <Button size={buttonSize} variant="secondary" loading={scheduling === "microsoft"} onClick={() => void scheduleViaConnected("microsoft")}>
          Schedule in Outlook
        </Button>
      ) : null}
      {secondary.map((link) => (
        <LinkButton
          key={link.label}
          size={buttonSize}
          variant="secondary"
          href={link.href}
          target={link.external ? "_blank" : undefined}
          rel={link.external ? "noreferrer" : undefined}
        >
          {link.label}
        </LinkButton>
      ))}
      {scheduleMessage ? <span className="action-do-message" role="status">{scheduleMessage}</span> : null}
    </div>
  );
}
