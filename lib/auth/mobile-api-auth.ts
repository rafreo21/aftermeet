import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseConfig } from "../supabase/env";
import type { AppUser } from "./context";

export async function getAppUserFromRequest(request: Request): Promise<AppUser | null> {
  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const config = readPublicSupabaseConfig().config;
  if (!bearer || !config) return null;

  const supabase = createSupabaseClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
  if (authError || !authData.user) return null;

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
    workspaceName: row.workspace_name ?? "My workspace",
    workspaceType: (row.workspace_type as AppUser["workspaceType"]) ?? "personal",
    workspaceRole: (row.workspace_role as AppUser["workspaceRole"]) ?? "owner",
  };
}
