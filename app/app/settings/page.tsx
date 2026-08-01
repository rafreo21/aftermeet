"use client";

import { AppShell } from "../../components/AppShell";
import { ConnectedAccountsPanel } from "../../components/ConnectedAccountsPanel";
import { NotificationPreferences } from "../../components/NotificationPreferences";

export default function ConsumerSettingsPage() {
  return (
    <AppShell active="settings" title="Settings">
      <div className="flow-page settings-page">
        <header className="flow-heading">
          <div><span className="step-pill">Settings</span><h1>Connected accounts</h1><p>Connect Google or Microsoft once, then choose which AfterMeet features use email, calendar, and recording storage.</p></div>
        </header>
        <NotificationPreferences />
        <ConnectedAccountsPanel />
      </div>
    </AppShell>
  );
}
