"use client";

import { useAppShellChrome } from "../../../components/AppShellChromeContext";
import { ConnectedAccountsPanel } from "../../../components/ConnectedAccountsPanel";

export default function ConnectedAccountsSettingsPage() {
  useAppShellChrome({ backHref: "/app/settings", backLabel: "Settings" });
  return (
    <div className="flow-page settings-page">
      <ConnectedAccountsPanel stacked returnTo="/app/settings/connected-accounts" />
    </div>
  );
}
