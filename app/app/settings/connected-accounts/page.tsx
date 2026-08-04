"use client";

import { useAppShellChrome } from "../../../components/AppShellChromeContext";
import { ConnectedAccountsPanel } from "../../../components/ConnectedAccountsPanel";

export default function ConnectedAccountsSettingsPage() {
  useAppShellChrome({ backHref: "/app/settings", backLabel: "Settings" });
  return (
    <div className="flow-page settings-page">
      <div className="flow-heading">
        <div><h1>Connected accounts</h1><p>Connect once per provider. You stay in control of which approved messages, meetings, and recordings use each account.</p></div>
      </div>
      <ConnectedAccountsPanel stacked returnTo="/app/settings/connected-accounts" />
    </div>
  );
}
