import type { SupabaseClient } from "@supabase/supabase-js";

import type { GuestFollowUp } from "./encounters";

type GuestFollowUpRow = {
  id: string;
  encounter_id: string;
  participant_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  note: string | null;
  committed_at: string;
};

export async function fetchGuestFollowUpsByEncounter(
  supabase: SupabaseClient,
  encounterIds: string[],
) {
  const grouped = new Map<string, GuestFollowUp[]>();
  if (!encounterIds.length) return grouped;

  const { data, error } = await supabase
    .from("encounter_guest_follow_ups")
    .select("id, encounter_id, participant_id, guest_name, guest_email, note, committed_at")
    .in("encounter_id", encounterIds)
    .order("committed_at", { ascending: false });

  // Older projects may not have the multi-guest table yet. The encounter's
  // legacy guest_follow_up value remains available through encounterFromApi.
  if (error) return grouped;

  for (const raw of data ?? []) {
    const row = raw as GuestFollowUpRow;
    const current = grouped.get(row.encounter_id) ?? [];
    current.push({
      id: row.id,
      participantId: row.participant_id ?? undefined,
      guestName: row.guest_name?.trim() || undefined,
      guestEmail: row.guest_email?.trim() || undefined,
      note: row.note?.trim() || undefined,
      committedAt: row.committed_at,
    });
    grouped.set(row.encounter_id, current);
  }

  return grouped;
}
