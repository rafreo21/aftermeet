import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAppUser } from "../../lib/auth/context";
import { AppUserProvider } from "../components/AppUserContext";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await requireAppUser();
  if (user.onboardingStatus !== "completed") redirect("/onboarding");
  return <AppUserProvider user={user}>{children}</AppUserProvider>;
}
