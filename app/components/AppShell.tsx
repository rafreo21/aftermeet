"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { IconButton, LinkButton } from "./Button";
import { useAppUser } from "./AppUserContext";
import { BrandMark } from "./BrandMark";
import { hydrateContactsFromServer } from "../../lib/contacts-sync";
import { hydrateEncountersFromServer } from "../../lib/encounters-sync";
import { hydrateCardLibraryFromServer } from "../../lib/card-library-sync";
import { NotificationBell } from "./NotificationBell";
import { ActiveCaptureBar } from "./ActiveCaptureBar";

export type AppShellActive = "home" | "people" | "cards" | "followups" | "settings";

type AppShellProps = {
  active: AppShellActive;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const consumerNav = [
  ["home", "/app", HouseIcon, "Home"],
  ["cards", "/app/cards", IdentificationCardIcon, "My card"],
  ["people", "/app/people", UsersThreeIcon, "Connections"],
  ["followups", "/app/followups", PaperPlaneTiltIcon, "Follow-ups"],
  ["settings", "/app/settings", GearIcon, "Settings"],
] as const;

let hydratedConsumerUser = "";

export function AppShell({ active, backHref, backLabel = "Back", actions, children }: AppShellProps) {
  const user = useAppUser();
  const [mobileNav, setMobileNav] = useState(false);
  const [actionableCount, setActionableCount] = useState(0);
  const updateActionableCount = useCallback((count: number) => setActionableCount(count), []);
  useEffect(() => {
    if (hydratedConsumerUser === user.email) return;
    hydratedConsumerUser = user.email;
    void hydrateContactsFromServer();
    void hydrateEncountersFromServer();
    void hydrateCardLibraryFromServer();
  }, [user.email]);
  const label = user.displayName || user.email.split("@")[0] || "AfterMeet user";
  const initials = label.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return (
    <main className="product-shell">
      <aside className={`product-sidebar ${mobileNav ? "open" : ""}`}>
        <Link className="product-logo" href="/app" prefetch={false}><BrandMark size={38} /><strong>AfterMeet</strong></Link>
        <nav aria-label="Consumer navigation">
          {consumerNav.map(([key, href, Icon, itemLabel]) => (
            <Link className={active === key ? "active" : ""} href={href} key={key} prefetch={false} onClick={() => setMobileNav(false)}>
              <Icon size={20} weight="bold" /> <span>{itemLabel}</span>
              {key === "followups" && actionableCount ? <b className="nav-count" aria-label={`${actionableCount} due follow-ups`}>{actionableCount > 99 ? "99+" : actionableCount}</b> : null}
            </Link>
          ))}
          <Link className="capture-nav" href="/app/encounters/new" prefetch={false} onClick={() => setMobileNav(false)}>
            <MicrophoneIcon size={20} weight="fill" /> Capture
          </Link>
          <Link href="/app/scan" prefetch={false} onClick={() => setMobileNav(false)}>
            <QrCodeIcon size={20} weight="bold" /> Scan
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-card">
            <span>{initials || "AM"}</span>
            <div>{label}<small>{user.email}</small></div>
            <form action="/auth/signout" method="post">
              <IconButton type="submit" aria-label="Sign out" title="Sign out"><SignOutIcon weight="bold" /></IconButton>
            </form>
          </div>
        </div>
      </aside>

      <section className="product-main">
        <div className="consumer-global-bell"><NotificationBell onActionableCountChange={updateActionableCount} /></div>
        <ActiveCaptureBar />
        <header className="product-mobile-header">
          <IconButton className="menu-button" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}>
            <ListIcon size={25} weight="bold" />
          </IconButton>
          <span className="mobile-logo">AfterMeet</span>
        </header>
        <div className="product-content">
          {backHref || actions ? (
            <div className="product-page-toolbar">
              {backHref ? (
                <LinkButton size="small" variant="ghost" href={backHref} className="product-page-back">
                  <ArrowLeftIcon size={16} weight="bold" />{backLabel}
                </LinkButton>
              ) : <span />}
              {actions ? <div className="product-page-actions">{actions}</div> : null}
            </div>
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}
