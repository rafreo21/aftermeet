"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { LinkButton } from "./Button";
import { BROWSER_NOTIFICATION_CHANGE_EVENT, BROWSER_NOTIFICATION_KEY } from "./NotificationPreferences";

type FollowUpAlert = {
  encounterId: string;
  actionId: string;
  title: string;
  dueAt: string;
  status: string;
  owner: "me" | "guest";
  personName: string;
  encounterTitle: string;
};

const READ_KEY = "aftermeet-read-notifications-v1";
const SHOWN_KEY = "aftermeet-shown-browser-notifications-v1";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function alertUrgency(dueAt: string): "overdue" | "today" | null {
  if (!dueAt) return null;
  const due = new Date(`${dueAt.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  const today = startOfToday();
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return null;
}

function alertId(alert: FollowUpAlert) {
  return `${alert.encounterId}:${alert.actionId}:${alert.dueAt}`;
}

function readStoredIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function NotificationBell({ onActionableCountChange }: { onActionableCountChange?: (count: number) => void }) {
  const [alerts, setAlerts] = useState<FollowUpAlert[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/follow-ups", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load alerts");
      const payload = await response.json() as { followUps?: FollowUpAlert[] };
      setAlerts((payload.followUps ?? []).filter((item) => item.owner === "me" && item.status !== "completed" && Boolean(alertUrgency(item.dueAt))));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => setReadIds(readStoredIds()));
    const syncBrowserPreference = () => setBrowserNotificationsEnabled(
      "Notification" in window
      && Notification.permission === "granted"
      && localStorage.getItem(BROWSER_NOTIFICATION_KEY) === "enabled",
    );
    void Promise.resolve().then(syncBrowserPreference);
    window.addEventListener(BROWSER_NOTIFICATION_CHANGE_EVENT, syncBrowserPreference);
    void Promise.resolve().then(load);
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(BROWSER_NOTIFICATION_CHANGE_EVENT, syncBrowserPreference);
    };
  }, [load]);

  useEffect(() => {
    if (!browserNotificationsEnabled || !("Notification" in window)) return;
    let shown = new Set<string>();
    try {
      const stored = JSON.parse(localStorage.getItem(SHOWN_KEY) || "[]");
      if (Array.isArray(stored)) shown = new Set(stored.filter((value): value is string => typeof value === "string"));
    } catch {}
    const nextAlerts = alerts.filter((alert) => !shown.has(alertId(alert)));
    for (const alert of nextAlerts) {
      const notification = new Notification(alert.title, {
        body: `${alert.personName || alert.encounterTitle} · ${alertUrgency(alert.dueAt) === "overdue" ? "Overdue" : "Due today"}`,
        tag: alertId(alert),
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign(`/app/encounters/${alert.encounterId}`);
        notification.close();
      };
      shown.add(alertId(alert));
    }
    localStorage.setItem(SHOWN_KEY, JSON.stringify(Array.from(shown).slice(-200)));
  }, [alerts, browserNotificationsEnabled]);

  useEffect(() => {
    onActionableCountChange?.(alerts.length);
  }, [alerts.length, onActionableCountChange]);

  useEffect(() => {
    function closeWhenOutside(event: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeWhenOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const unreadCount = useMemo(() => alerts.filter((alert) => !readIds.has(alertId(alert))).length, [alerts, readIds]);

  function persistRead(next: Set<string>) {
    setReadIds(next);
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(next)));
  }

  function markRead(alert: FollowUpAlert) {
    persistRead(new Set([...readIds, alertId(alert)]));
    setOpen(false);
  }

  function markAllRead() {
    persistRead(new Set([...readIds, ...alerts.map(alertId)]));
  }

  return (
    <div className="notification-bell-shell" ref={shellRef}>
      <button type="button" className="notification-bell-button" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
        <BellIcon size={20} weight={unreadCount ? "fill" : "bold"} />
        {unreadCount ? <span>{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <section className="notification-popover" role="dialog" aria-label="Notifications">
          <header>
            <div><span>Attention centre</span><h2>Notifications</h2></div>
            {unreadCount ? <button type="button" onClick={markAllRead}><CheckIcon size={14} weight="bold" />Mark all read</button> : null}
          </header>
          <div className="notification-popover-body">
            {loading ? <div className="notification-loading"><i /><i /><i /></div> : failed ? (
              <div className="notification-empty"><strong>Couldn&apos;t load notifications</strong><p>Check your connection and try again.</p><button type="button" onClick={() => void load()}>Try again</button></div>
            ) : alerts.length ? alerts.slice(0, 8).map((alert) => {
              const urgency = alertUrgency(alert.dueAt);
              const isUnread = !readIds.has(alertId(alert));
              return (
                <Link className={`notification-item ${isUnread ? "is-unread" : ""}`} href={`/app/encounters/${alert.encounterId}`} key={alertId(alert)} prefetch={false} onClick={() => markRead(alert)}>
                  <span className={`notification-status ${urgency}`}><ClockIcon size={17} weight="bold" /></span>
                  <span><strong>{alert.title}</strong><small>{alert.personName || alert.encounterTitle}</small><em>{urgency === "overdue" ? "Overdue" : "Due today"}</em></span>
                  {isUnread ? <i aria-label="Unread" /> : null}
                </Link>
              );
            }) : (
              <div className="notification-empty"><span><CheckIcon size={22} weight="bold" /></span><strong>You&apos;re all caught up</strong><p>New due-date alerts and meeting activity will appear here.</p></div>
            )}
          </div>
          <footer><LinkButton fullWidth variant="secondary" href="/app/followups" onClick={() => setOpen(false)}>Open follow-ups</LinkButton></footer>
        </section>
      ) : null}
    </div>
  );
}
