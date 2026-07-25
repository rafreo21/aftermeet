import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeIntendedDestination } from "../lib/auth/redirect.ts";
import { readPublicSupabaseConfig } from "../lib/supabase/env.ts";

test("redirect sanitizer preserves only internal application destinations", () => {
  assert.equal(sanitizeIntendedDestination("/app/people?view=recent"), "/app/people?view=recent");
  for (const unsafe of ["https://evil.test", "//evil.test", "%2F%2Fevil.test", "/hub", "/application", "\\\\evil.test"]) {
    assert.equal(sanitizeIntendedDestination(unsafe), "/app");
  }
});

test("environment validation names missing values", () => {
  const result = readPublicSupabaseConfig({});
  assert.equal(result.config, null);
  assert.deepEqual(result.missing, [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL",
  ]);
});

test("migration locks down browser-owned system writes", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202607240001_slice_1_auth_workspace.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /revoke all on public\.users, public\.workspaces, public\.workspace_memberships, public\.domain_events/);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /PersonalWorkspaceProvisioned/);
  assert.match(sql, /UserOnboardingCompleted/);
});
