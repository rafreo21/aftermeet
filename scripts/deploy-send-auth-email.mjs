#!/usr/bin/env node
/**
 * Deploy send-auth-email edge function via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN in env or .env.local
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "tgpzxgrvdmmwnodxrooh";
const FUNCTION_NAME = "send-auth-email";
const ENTRY = resolve(process.cwd(), "supabase/functions/send-auth-email/index.ts");

function readEnv(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const match = env.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // ignore
  }
  return "";
}

async function main() {
  const token = readEnv("SUPABASE_ACCESS_TOKEN");
  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN.");
    process.exit(1);
  }

  const content = readFileSync(ENTRY, "utf8");
  console.log(`Deploying ${FUNCTION_NAME} to ${PROJECT_REF}...`);

  let response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${FUNCTION_NAME}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slug: FUNCTION_NAME,
      name: FUNCTION_NAME,
      verify_jwt: false,
      import_map: false,
      entrypoint_path: "index.ts",
      files: [{ name: "index.ts", content }],
    }),
  });

  // A project that has never had this function deployed has nothing to PUT
  // onto — the create endpoint takes a different (non-multi-file) shape.
  if (response.status === 404) {
    response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug: FUNCTION_NAME,
        name: FUNCTION_NAME,
        verify_jwt: false,
        body: content,
      }),
    });
  }

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Deploy failed ${response.status}: ${body}`);
  }

  console.log("Deployed:", `https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}`);
  console.log("Run npm run configure:supabase-auth to wire the hook + Resend secrets.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
