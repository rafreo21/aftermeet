"use client";

import { useState, type ReactNode } from "react";
import { CheckSquareIcon } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { IconButton } from "./Button";
import { useAppUser } from "./AppUserContext";

type AppShellProps = {
  active: "home" | "cards" | "contacts" | "followups";
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ active, title, subtitle, actions, children }: AppShellProps) {
  const user = useAppUser();
  const [mobileNav, setMobileNav] = useState(false);
  const label = user.displayName || user.email.split("@")[0] || "AfterMeet user";
  const initials = label.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const nav = [
    ["home", "/app", HouseIcon, "Home"],
    ["cards", "/app/cards", IdentificationCardIcon, "My card"],
    ["contacts", "/app/contacts", UsersThreeIcon, "Contacts"],
    ["followups", "/app/followups", PaperPlaneTiltIcon, "Follow-ups"],
  ] as const;

  return (
    <main className="product-shell">
      <aside className={`product-sidebar ${mobileNav ? "open" : ""}`}>
        <a className="product-logo" href="/app"><span>A</span><strong>AfterMeet</strong></a>
        <nav aria-label="Product navigation">
          {nav.map(([key, href, Icon, label]) => (
            <a className={active === key ? "active" : ""} href={href} key={key}>
              <Icon size={20} weight="bold" /> {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/hub"><CheckSquareIcon size={20} weight="bold" /> MVP hub</a>
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
