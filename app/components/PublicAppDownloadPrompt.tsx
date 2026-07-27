"use client";

import { AppleLogoIcon } from "@phosphor-icons/react/dist/csr/AppleLogo";
import { GooglePlayLogoIcon } from "@phosphor-icons/react/dist/csr/GooglePlayLogo";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { LinkButton } from "./Button";
import { getAppStoreUrl, getPlayStoreUrl, detectMobilePlatform } from "@/lib/app-store-links";

export function PublicAppDownloadPrompt({
  ownerName,
  visitorEmail,
  onClose,
}: {
  ownerName: string;
  visitorEmail?: string;
  onClose?: () => void;
}) {
  const platform = detectMobilePlatform();
  const playStoreUrl = getPlayStoreUrl();
  const appStoreUrl = getAppStoreUrl();

  return (
    <div className="public-app-download" role="dialog" aria-modal="true" aria-labelledby="app-download-title">
      <div className="public-app-download-card">
        <div className="public-app-download-icon">
          <DeviceMobileIcon size={34} weight="bold" />
        </div>
        <h2 id="app-download-title">Remember who you meet</h2>
        <p>
          {ownerName} has your details. Download AfterMeet to keep everyone you meet in one place
          {visitorEmail ? ` — sign in with ${visitorEmail} when you open the app.` : "."}
        </p>

        <div className="public-app-download-actions">
          {(platform === "android" || platform === "unknown") ? (
            <LinkButton fullWidth href={playStoreUrl} target="_blank" rel="noreferrer">
              <GooglePlayLogoIcon size={20} weight="fill" />
              Get it on Google Play
            </LinkButton>
          ) : null}
          {(platform === "ios" || platform === "unknown") ? (
            <LinkButton fullWidth variant="secondary" href={appStoreUrl} target="_blank" rel="noreferrer">
              <AppleLogoIcon size={20} weight="fill" />
              Download on the App Store
            </LinkButton>
          ) : null}
        </div>

        {onClose ? (
          <button type="button" className="ghost-link public-app-download-close" onClick={onClose}>
            Back to {ownerName}&apos;s card
          </button>
        ) : null}
      </div>
    </div>
  );
}
