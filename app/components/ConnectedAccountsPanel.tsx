"use client";

import { useEffect, useState } from "react";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { LinkButton } from "./Button";
import { StatusMessage } from "./AsyncState";
import type { ConnectedAccountStatus } from "../../lib/integrations/types";
import { emptyConnectedAccountStatus } from "../../lib/integrations/types";

export function ConnectedAccountsPanel() {
  const [status, setStatus] = useState<ConnectedAccountStatus>(emptyConnectedAccountStatus());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/integrations/status");
    if (!response.ok) return;
    const payload = await response.json() as { status?: ConnectedAccountStatus };
    if (payload.status) setStatus(payload.status);
  }

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    if (integration === "google-connected") setMessage("Google account connected. Approved drafts can send through Gmail and Google Calendar.");
    if (integration === "microsoft-connected") setMessage("Microsoft account connected. Approved drafts can send through Outlook.");
    if (integration === "google-error" || integration === "microsoft-error") setError("We couldn’t connect that account. Try again.");
    if (integration === "google-unconfigured" || integration === "microsoft-unconfigured") {
      setError("Add integration OAuth credentials in your environment before connecting accounts.");
    }
  }, []);

  async function disconnect(provider: "google" | "microsoft") {
    setError("");
    setMessage("");
    const response = await fetch(`/api/integrations/${provider}`, { method: "DELETE" });
    if (!response.ok) {
      setError("We couldn’t disconnect that account.");
      return;
    }
    setMessage(`${provider === "google" ? "Google" : "Microsoft"} disconnected.`);
    await refresh();
  }

  return (
    <section className="activate-panel">
      <header>
        <span className="step-pill">Connected accounts</span>
        <h2><EnvelopeSimpleIcon size={22} weight="bold" /> Gmail, Outlook, and Calendar</h2>
        <p>Connect once, then send approved outbound drafts and schedule meetings through your own account — still review-first, never auto-send.</p>
      </header>

      <div className="connected-account-grid">
        <article className="connected-account-card">
          <div>
            <strong>Google</strong>
            <p>{status.google.connected ? status.google.email : "Send via Gmail and schedule in Google Calendar."}</p>
          </div>
          {status.google.connected ? (
            <button type="button" className="ghost-link" onClick={() => void disconnect("google")}>Disconnect</button>
          ) : (
            <LinkButton href="/api/integrations/google/connect" variant="secondary" disabled={!status.configured.google}>
              Connect Google
            </LinkButton>
          )}
        </article>

        <article className="connected-account-card">
          <div>
            <strong>Microsoft</strong>
            <p>{status.microsoft.connected ? status.microsoft.email : "Send via Outlook and schedule in Outlook Calendar."}</p>
          </div>
          {status.microsoft.connected ? (
            <button type="button" className="ghost-link" onClick={() => void disconnect("microsoft")}>Disconnect</button>
          ) : (
            <LinkButton href="/api/integrations/microsoft/connect" variant="secondary" disabled={!status.configured.microsoft}>
              Connect Microsoft
            </LinkButton>
          )}
        </article>
      </div>

      {!status.configured.google && !status.configured.microsoft ? (
        <StatusMessage tone="error">
          Set `GOOGLE_INTEGRATION_CLIENT_ID`, `GOOGLE_INTEGRATION_CLIENT_SECRET`, `MICROSOFT_INTEGRATION_CLIENT_ID`, and `MICROSOFT_INTEGRATION_CLIENT_SECRET` to enable OAuth.
        </StatusMessage>
      ) : null}
      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      <small className="connected-account-note"><CalendarBlankIcon size={14} weight="bold" /> Deep-link fallbacks still work when an account is not connected.</small>
    </section>
  );
}
