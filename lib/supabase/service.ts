import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseConfig } from "./env";

export function createServiceSupabaseClient() {
  const config = readPublicSupabaseConfig().config;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceRoleKey) return null;
  return createSupabaseClient(config.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const ENCOUNTER_RECORDINGS_BUCKET = "encounter-recordings";
