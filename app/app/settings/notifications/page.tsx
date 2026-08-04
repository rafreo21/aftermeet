"use client";

import { useAppShellChrome } from "../../../components/AppShellChromeContext";
import { NotificationPreferences } from "../../../components/NotificationPreferences";

export default function NotificationSettingsPage() {
  useAppShellChrome({ backHref: "/app/settings", backLabel: "Settings" });
  return (
    <div className="flow-page settings-page">
      <NotificationPreferences />
    </div>
  );
}
