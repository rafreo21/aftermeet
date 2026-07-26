#!/usr/bin/env node
/**
 * Add AfterMeet production and local auth callback URLs to Supabase.
 *
 * Usage:
 *   export SUPABASE_ACCESS_TOKEN="sbp_..."
 *   node scripts/configure-auth-redirects.mjs
 *
 * Optional:
 *   SUPABASE_PROJECT_REF=tgpzxgrvdmmwnodxrooh
 *   AFTERMEET_SITE_URL=https://aftermeet-beta.vercel.app
 *   AFTERMEET_REDIRECT_URLS=https://aftermeet-beta.vercel.app/auth/callback,http://localhost:3000/auth/callback,http://localhost:3001/auth/callback
 */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "tgpzxgrvdmmwnodxrooh";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const PRODUCTION_URL = "https://aftermeet-beta.vercel.app";
const SITE_URL = (process.env.AFTERMEET_SITE_URL ?? PRODUCTION_URL).replace(/\/+$/, "");
const REDIRECT_URLS =
  process.env.AFTERMEET_REDIRECT_URLS ??
  [
    `${PRODUCTION_URL}/auth/callback`,
    "http://localhost:3000/auth/callback",
    "http://localhost:3001/auth/callback",
  ].join(",");

async function patchAuthConfig(payload) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase API ${response.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  if (!ACCESS_TOKEN) {
    console.error("Missing SUPABASE_ACCESS_TOKEN.");
    console.error("Create one at https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }

  const payload = {
    site_url: SITE_URL,
    uri_allow_list: REDIRECT_URLS,
  };

  console.log(`Updating Supabase auth URLs for project ${PROJECT_REF}...`);
  console.log(`  site_url: ${payload.site_url}`);
  console.log(`  uri_allow_list: ${payload.uri_allow_list}`);
  await patchAuthConfig(payload);
  console.log("\nDone. Production sign-in should now redirect correctly.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
