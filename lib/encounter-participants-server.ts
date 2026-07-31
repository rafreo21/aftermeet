import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EncounterParticipant } from "./encounters";

export async function fetchParticipantsByEncounter(
  supabase: SupabaseClient,
  encounterIds: string[],
): Promise<Map<string, EncounterParticipant[]>> {
  const byEncounter = new Map<string, EncounterParticipant[]>();
  if (!encounterIds.length) return byEncounter;

  const { data } = await supabase
    .from("encounter_participants")
    .select("encounter_id, id, display_name, email, phone, linkedin_url, exchange_id, sort_order")
    .in("encounter_id", encounterIds)
    .order("sort_order", { ascending: true });

  for (const row of data ?? []) {
    const list = byEncounter.get(row.encounter_id) ?? [];
    list.push({
      id: row.id,
      name: row.display_name ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      linkedIn: row.linkedin_url ?? "",
      exchangeId: row.exchange_id ?? undefined,
    });
    byEncounter.set(row.encounter_id, list);
  }
  return byEncounter;
}
