import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.local");
const projectLink = join(root, ".vercel", "project.json");

if (process.env.AI_GATEWAY_API_KEY?.trim()) {
  process.exit(0);
}

if (!existsSync(projectLink)) {
  console.warn("[aftermeet] Skipping AI env refresh: link the project with `npx vercel link` or set AI_GATEWAY_API_KEY.");
  process.exit(0);
}

const result = spawnSync(
  "npx",
  ["vercel@latest", "env", "pull", ".env.local", "--environment=development", "--yes"],
  { cwd: root, stdio: "inherit", env: process.env },
);

if (result.status !== 0) {
  console.warn("[aftermeet] Could not refresh VERCEL_OIDC_TOKEN. Add AI_GATEWAY_API_KEY to .env.local for set-and-forget local AI.");
}
