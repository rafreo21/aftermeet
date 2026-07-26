import {
  encounterToApiBody,
  readEncounters,
  writeEncounters,
  type Encounter,
} from "./encounters";
import { encounterOnServer, mergeEncounterRows, sortEncounters } from "./encounter-list-sync";

export { encounterOnServer, mergeEncounterRows, sortEncounters } from "./encounter-list-sync";

let hydratePromise: Promise<Encounter[]> | null = null;

export async function syncEncounterToServer(encounter: Encounter) {
  try {
    const response = await fetch("/api/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encounterToApiBody(encounter)),
    });
    if (!response.ok) return null;
    return encounter;
  } catch {
    return null;
  }
}

export async function hydrateEncountersFromServer() {
  if (typeof window === "undefined") return readEncounters();
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const response = await fetch("/api/encounters");
      if (!response.ok) return readEncounters();

      const payload = await response.json() as { encounters?: Encounter[]; preview?: boolean };
      if (payload.preview) return readEncounters();

      let serverEncounters = payload.encounters ?? [];
      const localEncounters = readEncounters();
      const localById = new Map(localEncounters.map((encounter) => [encounter.id, encounter]));

      for (const local of localEncounters) {
        if (encounterOnServer(local, serverEncounters)) continue;
        const synced = await syncEncounterToServer(local);
        if (synced) {
          serverEncounters = [
            synced,
            ...serverEncounters.filter((encounter) => encounter.id !== synced.id),
          ];
        }
      }

      const merged = serverEncounters.map((server) => mergeEncounterRows(server, localById.get(server.id)));
      const serverIds = new Set(merged.map((encounter) => encounter.id));
      const unsyncedLocal = localEncounters.filter((local) => !serverIds.has(local.id));
      const final = sortEncounters([...merged, ...unsyncedLocal]);

      if (final.length) {
        writeEncounters(final);
        return final;
      }

      return readEncounters();
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export function queueEncounterSync(encounter: Encounter) {
  void syncEncounterToServer(encounter);
}
