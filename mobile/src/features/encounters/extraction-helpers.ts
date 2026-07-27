import type { EncounterDraft } from '@/features/encounters/encounter-api';

export function applyExtractionDraft(
  current: {
    title: string;
    personName: string;
    privateNotes: string;
    sharedSummary: string;
    followUp: string;
    followUpType: EncounterDraft['followUpType'];
  },
  draft: EncounterDraft,
  options?: { replace?: boolean },
) {
  if (options?.replace) {
    return {
      ...current,
      title: draft.title,
      personName: draft.personName,
      privateNotes: draft.privateNotes,
      sharedSummary: draft.sharedSummary,
      followUp: draft.followUp,
      followUpType: draft.followUpType,
    };
  }

  return {
    ...current,
    title: current.title || draft.title,
    personName: current.personName || draft.personName,
    privateNotes: current.privateNotes || draft.privateNotes,
    sharedSummary: current.sharedSummary || draft.sharedSummary,
    followUp: current.followUp || draft.followUp,
    followUpType: current.followUp ? current.followUpType : draft.followUpType,
  };
}

export const EXTRACTION_DRAFT_NOTE = {
  ai: 'AI draft from your transcript — check names and facts before saving.',
  heuristic: 'Suggested draft from your transcript — check names and facts before saving.',
  aiNotConfigured:
    'Draft generated from your transcript — check names and facts before saving.',
  aiFallback:
    'AI summary unavailable — using a structured draft from your transcript. Check names and facts before saving.',
} as const;
