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
      sharedSummary: draft.sharedSummary,
      followUp: draft.followUp,
      followUpType: draft.followUpType,
      privateNotes: '',
    };
  }

  return {
    ...current,
    title: current.title || draft.title,
    sharedSummary: current.sharedSummary || draft.sharedSummary,
    followUp: current.followUp || draft.followUp,
    followUpType: current.followUp ? current.followUpType : draft.followUpType,
    privateNotes: '',
  };
}

export const EXTRACTION_DRAFT_NOTE = {
  ai: 'AI draft from your transcript. Check the title and share summary before saving.',
  heuristic: 'Suggested draft from your transcript. Check the title and share summary before saving.',
  aiNotConfigured:
    'Draft generated from your transcript. Check the title and share summary before saving.',
  aiFallback:
    'AI summary unavailable. Using a structured draft from your transcript. Check the title and share summary before saving.',
} as const;
