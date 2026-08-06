"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import type { ActionLinkContext } from "../../lib/action-links";
import { resolveActionLink, resolveSecondaryActionLinks } from "../../lib/action-links";
import type { EncounterAction } from "../../lib/encounters";
import { emptyConnectedAccountStatus, type ConnectedAccountStatus } from "../../lib/integrations/types";
import { LinkButton } from "./Button";
import { DropdownButton, type DropdownItem } from "./DropdownButton";

type ActionDoButtonProps = {
  action: Pick<EncounterAction, "channel" | "title" | "dueAt" | "status" | "owner">;
  context: ActionLinkContext;
  size?: "small" | "medium";
  showSecondary?: boolean;
};

const TRIGGER_LABEL: Partial<Record<EncounterAction["channel"], string>> = {
  meeting: "Schedule",
  send: "Send the file",
  email: "Send email",
  other: "Send email",
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

  // Meeting always has two providers to choose between — always offer both
  // as a dropdown rather than defaulting to whichever the code picks first.
  if (action.channel === "meeting") {
    const items: DropdownItem[] = [
      integrations.google.connected
        ? { key: "google", label: "Google Calendar", onSelect: () => void scheduleViaConnected("google") }
        : { key: "google", label: "Google Calendar", href: primary.href, external: primary.external },
      integrations.microsoft.connected
        ? { key: "outlook", label: "Outlook Calendar", onSelect: () => void scheduleViaConnected("microsoft") }
        : { key: "outlook", label: "Outlook Calendar", href: secondary.find((link) => link.label === "Outlook Calendar")?.href, external: true },
    ];
    return (
      <div className="action-do-group">
        <DropdownButton
          label={TRIGGER_LABEL.meeting}
          icon={<CalendarBlankIcon size={14} weight="bold" />}
          items={items}
          size={buttonSize}
          loading={scheduling !== ""}
        />
        {scheduleMessage ? <span className="action-do-message" role="status">{scheduleMessage}</span> : null}
      </div>
    );
  }

  // Multiple ways to send (Gmail/Outlook/Mail app/Drive) — collapse into one
  // dropdown instead of a button per option. Falls through to the plain
  // single-button case below when there's nothing to choose between (no
  // email on file, so only one delivery method resolved).
  if (secondary.length > 0) {
    const items: DropdownItem[] = [
      { key: "primary", label: primary.label, href: primary.href, external: primary.external },
      ...secondary.map((link) => ({ key: link.label, label: link.label, href: link.href, external: link.external })),
    ];
    return (
      <div className="action-do-group">
        <DropdownButton label={TRIGGER_LABEL[action.channel] ?? primary.label} items={items} size={buttonSize} />
      </div>
    );
  }

  return (
    <div className="action-do-group">
      <LinkButton
        size={buttonSize}
        href={primary.href}
        target={primary.external ? "_blank" : undefined}
        rel={primary.external ? "noreferrer" : undefined}
      >
        {primary.label}
        {primary.external ? <ArrowSquareOutIcon size={14} weight="bold" /> : null}
      </LinkButton>
    </div>
  );
}
