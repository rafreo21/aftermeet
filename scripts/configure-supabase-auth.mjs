#!/usr/bin/env node
/**
 * Configure Supabase Auth for AfterMeet (web + mobile OTP sign-in).
 *
 * Uses Supabase Send Email Hook + Resend (no Vercel integration required).
 *
 * 1. Create a free Resend account: https://resend.com/signup
 * 2. Create an API key: https://resend.com/api-keys
 * 3. Add to .env.local:
 *      SUPABASE_ACCESS_TOKEN=sbp_...
 *      RESEND_API_KEY=re_...
 *      RESEND_FROM_EMAIL=AfterMeet <onboarding@resend.dev>
 *    (Use a verified domain sender for production, e.g. auth@yourdomain.com)
 * 4. Run: npm run configure:supabase-auth
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "tgpzxgrvdmmwnodxrooh";
const PRODUCTION_URL = "https://aftermeet-beta.vercel.app";
const SITE_URL = (process.env.AFTERMEET_SITE_URL ?? PRODUCTION_URL).replace(/\/+$/, "");
const HOOK_FUNCTION = "send-auth-email";

function loadEnvFile() {
  try {
    return readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return "";
  }
}

function readEnv(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  const env = loadEnvFile();
  const match = env.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const REDIRECT_URLS = [
  `${SITE_URL}/auth/callback`,
  `${SITE_URL}/auth/mobile-return`,
  `${SITE_URL}/**`,
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/auth/mobile-return",
  "http://localhost:3000/**",
  "http://localhost:3001/auth/callback",
  "http://localhost:3001/auth/mobile-return",
  "http://localhost:3001/**",
  "aftermeet://auth/callback",
  "aftermeet://**",
  "exp://**",
  "https://aftermeet-*-rafreo21-8924s-projects.vercel.app/**",
  "https://aftermeet-rafreo21-8924s-projects.vercel.app/**",
].join(",");

async function api(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase API ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function generateHookSecret() {
  const existing = readEnv("SEND_EMAIL_HOOK_SECRET");
  if (existing) return existing;
  return `v1,whsec_${randomBytes(32).toString("base64")}`;
}

async function setSecrets(token, secrets) {
  await api(token, "/secrets", {
    method: "POST",
    body: secrets.map(({ name, value }) => ({ name, value })),
  });
}

async function main() {
  const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
  const resendApiKey = readEnv("RESEND_API_KEY");
  const resendFrom = readEnv("RESEND_FROM_EMAIL") || "AfterMeet <onboarding@resend.dev>";
  const hookSecret = generateHookSecret();
  const hookUri = `https://${PROJECT_REF}.supabase.co/functions/v1/${HOOK_FUNCTION}`;

  if (!accessToken) {
    console.error("Missing SUPABASE_ACCESS_TOKEN.");
    console.error("Create one at https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }

  if (!resendApiKey) {
    console.error("Missing RESEND_API_KEY.");
    console.error("");
    console.error("Skip Vercel — set this up directly on Resend:");
    console.error("  1. Sign up: https://resend.com/signup");
    console.error("  2. Create API key: https://resend.com/api-keys");
    console.error("  3. Add to .env.local: RESEND_API_KEY=re_...");
    console.error("  4. Rerun: npm run configure:supabase-auth");
    console.error("");
    console.error("For testing, RESEND_FROM_EMAIL=AfterMeet <onboarding@resend.dev> only delivers");
    console.error("to the email you used on Resend. Add your domain in Resend for production.");
    process.exit(1);
  }

  console.log(`Configuring Supabase Auth (${PROJECT_REF})...`);
  console.log("  delivery: Send Email Hook → Resend (6-digit codes, no magic links)");
  console.log("  hook URL:", hookUri);
  console.log("  from:", resendFrom);

  console.log("\nSetting edge function secrets...");
  await setSecrets(accessToken, [
    { name: "RESEND_API_KEY", value: resendApiKey },
    { name: "SEND_EMAIL_HOOK_SECRET", value: hookSecret },
    { name: "RESEND_FROM_EMAIL", value: resendFrom },
  ]);

  console.log("Updating auth config...");
  await api(accessToken, "/config/auth", {
    method: "PATCH",
    body: {
      site_url: SITE_URL,
      uri_allow_list: REDIRECT_URLS,
      external_email_enabled: true,
      hook_send_email_enabled: true,
      hook_send_email_uri: hookUri,
      hook_send_email_secrets: hookSecret,
      rate_limit_email_sent: 30,
      mailer_secure_email_change_enabled: false,
    },
  });

  const current = await api(accessToken, "/config/auth");

  console.log("\nDone.");
  console.log("  site_url:", current.site_url);
  console.log("  send email hook:", current.hook_send_email_enabled ? "enabled" : "disabled");
  console.log("  email rate limit / hour:", current.rate_limit_email_sent ?? 30);
  console.log("");
  console.log("Next: deploy the edge function if you haven't yet:");
  console.log("  npm run deploy:send-auth-email");
  console.log("");
  console.log("Save this hook secret in .env.local if you generated a new one:");
  console.log(`  SEND_EMAIL_HOOK_SECRET=${hookSecret}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
