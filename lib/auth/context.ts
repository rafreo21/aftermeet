import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { readPublicSupabaseConfig } from "../supabase/env";

export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  onboardingStatus: string;
  workspaceId: string;
};

function isLocalDevelopmentPreview() {
  return process.env.NODE_ENV === "development" && process.env.AFTERMEET_DEV_PREVIEW === "true";
}

export async function getAppUser(): Promise<AppUser | null> {
  if (isLocalDevelopmentPreview()) {
    return {
      id: "local-development-preview",
      email: "preview@aftermeet.local",
      displayName: "Raf",
      avatarUrl: null,
      onboardingStatus: "completed",
      workspaceId: "local-development-workspace",
    };
  }
  if (!readPublicSupabaseConfig().config) return null;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;
  const { data, error } = await supabase.rpc("get_my_app_context").single();
  if (error || !data) return null;
  const row = data as Record<string, string | null>;
  return {
    id: row.user_id!,
    email: row.primary_email ?? authData.user.email ?? "",
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    onboardingStatus: row.onboarding_status!,
    workspaceId: row.workspace_id!,
  };
}

export async function requireAppUser(): Promise<AppUser> {
  if (isLocalDevelopmentPreview()) return (await getAppUser())!;
  if (!readPublicSupabaseConfig().config) redirect("/auth?error=configuration");
  const user = await getAppUser();
  if (!user) redirect("/auth");
  return user;
}
