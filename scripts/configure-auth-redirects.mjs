#!/usr/bin/env node
/**
 * @deprecated Use scripts/configure-supabase-auth.mjs instead.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "configure-supabase-auth.mjs");
const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
