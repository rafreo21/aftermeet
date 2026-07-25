"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppUser } from "../../lib/auth/context";

const Context = createContext<AppUser | null>(null);

export function AppUserProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  return <Context.Provider value={user}>{children}</Context.Provider>;
}

export function useAppUser() {
  const user = useContext(Context);
  if (!user) throw new Error("AppUserProvider is required inside the authenticated application.");
  return user;
}
