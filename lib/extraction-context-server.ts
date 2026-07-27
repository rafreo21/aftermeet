import "server-only";

import { createApiSupabaseClient } from "./auth/api-request";
import type { AppUser } from "./auth/context";
import type { ExtractionOwnerContext } from "./encounter-extraction";

function uniqueNames(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names;
}

export async function loadExtractionOwnerContext(
  request: Request,
  user: AppUser,
): Promise<ExtractionOwnerContext> {
  const ownerNames = uniqueNames([user.displayName]);

  if (user.id === "local-development-preview") {
    return {
      ownerNames: ownerNames.length ? ownerNames : ["Raf"],
      ownerEmail: user.email,
      recentMeetings: [],
    };
  }

  const supabase = await createApiSupabaseClient(request);

  const { data: cards } = await supabase
    .from("cards")
    .select("full_name")
    .eq("workspace_id", user.workspaceId)
    .order("updated_at", { ascending: false })
    .limit(3);

  for (const card of cards ?? []) {
    ownerNames.push(...uniqueNames([card.full_name]).filter((name) => !ownerNames.some((existing) => existing.toLowerCase() === name.toLowerCase())));
  }

  const { data: encounters } = await supabase
    .from("encounters")
    .select("person_name, private_notes, shared_summary")
    .eq("workspace_id", user.workspaceId)
    .order("started_at", { ascending: false })
    .limit(10);

  const recentMeetings = (encounters ?? [])
    .filter((row) => row.person_name?.trim() || row.private_notes?.trim() || row.shared_summary?.trim())
    .slice(0, 5)
    .map((row) => ({
      personName: row.person_name?.trim() ?? "",
      privateNotesSample: row.private_notes?.trim().slice(0, 320) ?? "",
      sharedSummarySample: row.shared_summary?.trim().slice(0, 320) ?? "",
    }));

  return {
    ownerNames,
    ownerEmail: user.email,
    recentMeetings,
  };
}
