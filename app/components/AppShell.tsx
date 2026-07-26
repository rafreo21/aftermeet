"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { IconButton } from "./Button";
import { useAppUser } from "./AppUserContext";
import { BrandMark } from "./BrandMark";
import { hydrateContactsFromServer } from "../../lib/contacts-sync";
import { hydrateEncountersFromServer } from "../../lib/encounters-sync";
import { hydrateCardLibraryFromServer } from "../../lib/card-library-sync";

type AppShellProps = {
  active: "home" | "people" | "cards" | "contacts" | "followups" | "activate";
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ active, title, subtitle, actions, children }: AppShellProps) {
  const user = useAppUser();
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => {
    void hydrateContactsFromServer();
    void hydrateEncountersFromServer();
    void hydrateCardLibraryFromServer();
  }, []);
  const label = user.displayName || user.email.split("@")[0] || "AfterMeet user";
  const initials = label.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const nav = [
    ["home", "/app", HouseIcon, "Home"],
    ["people", "/app/people", UsersThreeIcon, "People you've met"],
    ["cards", "/app/cards", IdentificationCardIcon, "My card"],
    ["contacts", "/app/contacts", UsersThreeIcon, "My contacts"],
    ["followups", "/app/followups", PaperPlaneTiltIcon, "Inbox"],
    ["activate", "/app/activate", ChartLineUpIcon, "Activate"],
  ] as const;

  return (
    <main className="product-shell">
      <aside className={`product-sidebar ${mobileNav ? "open" : ""}`}>
        <a className="product-logo" href="/app"><BrandMark size={38} /><strong>AfterMeet</strong></a>
        <nav aria-label="Product navigation">
          {nav.map(([key, href, Icon, label]) => (
            <a className={active === key ? "active" : ""} href={href} key={key}>
              <Icon size={20} weight="bold" /> {label}
            </a>
          ))}
          <a className="capture-nav" href="/app/encounters/new">
            <MicrophoneIcon size={20} weight="fill" /> Capture
          </a>
          <a href="/app/scan">
            <QrCodeIcon size={20} weight="bold" /> Scan badge
          </a>
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
        <header className="product-header">
          <IconButton className="menu-button" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}>
            <ListIcon size={25} weight="bold" />
          </IconButton>
          <div>
            <span className="mobile-logo">AfterMeet</span>
            <strong className="header-title">{title}</strong>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="header-actions">{actions}</div>
        </header>
        <div className="product-content">{children}</div>
      </section>
    </main>
  );
}
