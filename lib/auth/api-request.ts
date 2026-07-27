import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseConfig } from "../supabase/env";
import { createClient } from "../supabase/server";
import type { AppUser } from "./context";
import { getAppUser } from "./context";
import { getAppUserFromRequest } from "./mobile-api-auth";

export async function resolveApiUser(request: Request): Promise<AppUser | null> {
  return (await getAppUserFromRequest(request)) ?? (await getAppUser());
}

export async function createApiSupabaseClient(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const config = readPublicSupabaseConfig().config;

  if (bearer && config) {
    return createSupabaseClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }

  return createClient();
}
