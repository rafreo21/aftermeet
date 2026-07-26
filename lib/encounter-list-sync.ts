import type { Encounter } from "./encounters";

export function encounterOnServer(local: Encounter, serverEncounters: Encounter[]) {
  return serverEncounters.some((server) => server.id === local.id);
}

export function mergeEncounterRows(server: Encounter, local: Encounter | undefined) {
  if (!local) return server;
  return {
    ...server,
    recording: local.recording ?? server.recording,
  };
}

export function sortEncounters(encounters: Encounter[]) {
  return [...encounters].sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
}
