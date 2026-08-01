"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { StatusMessage } from "./AsyncState";

export const BROWSER_NOTIFICATION_KEY = "aftermeet-browser-notifications-v1";
export const BROWSER_NOTIFICATION_CHANGE_EVENT = "aftermeet-browser-notifications-change";

type BrowserPermission = NotificationPermission | "unsupported";

function readBrowserEnabled() {
  return typeof window !== "undefined" && localStorage.getItem(BROWSER_NOTIFICATION_KEY) === "enabled";
}

function PreferenceSwitch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`preference-switch ${checked ? "is-on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    ><span /></button>
  );
}

export function NotificationPreferences() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermission>("unsupported");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const permission: BrowserPermission = "Notification" in window ? Notification.permission : "unsupported";
    void Promise.resolve().then(() => {
      setBrowserPermission(permission);
      setBrowserEnabled(readBrowserEnabled() && permission === "granted");
    });
    void fetch("/api/settings/notifications", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { emailRemindersEnabled?: boolean; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load notification preferences.");
        setEmailEnabled(payload.emailRemindersEnabled !== false);
      })
      .catch((error) => setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not load notification preferences." }))
      .finally(() => setLoading(false));
  }, []);

  async function toggleEmail(next: boolean) {
    const previous = emailEnabled;
    setEmailEnabled(next);
    setEmailSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailRemindersEnabled: next }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not update email reminders.");
      setMessage({ tone: "success", text: next ? "Email reminders are on across AfterMeet." : "Email reminders are off across AfterMeet." });
    } catch (error) {
      setEmailEnabled(previous);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not update email reminders." });
    } finally {
      setEmailSaving(false);
    }
  }

  async function toggleBrowser(next: boolean) {
    setMessage(null);
    if (!next) {
      localStorage.removeItem(BROWSER_NOTIFICATION_KEY);
      setBrowserEnabled(false);
      window.dispatchEvent(new Event(BROWSER_NOTIFICATION_CHANGE_EVENT));
      setMessage({ tone: "success", text: "Browser notifications are off in this browser." });
      return;
    }
    if (!("Notification" in window)) {
      setMessage({ tone: "error", text: "This browser does not support browser notifications." });
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission !== "granted") {
      localStorage.removeItem(BROWSER_NOTIFICATION_KEY);
      setBrowserEnabled(false);
      setMessage({ tone: "error", text: permission === "denied" ? "Notifications are blocked. Allow them in your browser’s site settings." : "Permission was not granted, so browser notifications remain off." });
      return;
    }
    localStorage.setItem(BROWSER_NOTIFICATION_KEY, "enabled");
    setBrowserEnabled(true);
    window.dispatchEvent(new Event(BROWSER_NOTIFICATION_CHANGE_EVENT));
    setMessage({ tone: "success", text: "Browser notifications are on for this browser." });
  }

  return (
    <section className="settings-panel notification-preferences" aria-labelledby="notification-preferences-heading">
      <header><div><span className="step-pill">Reminders</span><h2 id="notification-preferences-heading">Notification preferences</h2><p>Choose how AfterMeet reminds you about follow-ups.</p></div></header>
      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}
      <div className="preference-row">
        <span className="preference-icon"><EnvelopeSimpleIcon size={22} weight="bold" /></span>
        <div><h3>Email reminders</h3><p>Email me when a follow-up becomes overdue. This preference is shared with iOS and Android.</p></div>
        <PreferenceSwitch checked={emailEnabled} disabled={loading || emailSaving} label="Email reminders" onChange={(next) => void toggleEmail(next)} />
      </div>
      <div className="preference-row">
        <span className="preference-icon"><BellIcon size={22} weight="bold" /></span>
        <div><h3>Browser notifications</h3><p>Show due follow-up alerts in this browser while AfterMeet is open.</p>{browserPermission === "denied" ? <small>Blocked in browser settings</small> : browserPermission === "unsupported" ? <small>Not supported by this browser</small> : null}</div>
        <PreferenceSwitch checked={browserEnabled} disabled={browserPermission === "unsupported"} label="Browser notifications" onChange={(next) => void toggleBrowser(next)} />
      </div>
      <div className="preference-footnote"><p><strong>Mobile reminders are managed on each phone.</strong> iOS and Android permission controls do not appear on the web.</p></div>
    </section>
  );
}
