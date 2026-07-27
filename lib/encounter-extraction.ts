import type { Encounter } from "./encounters";
import {
  buildFollowUp,
  buildMeetingTitle,
  buildPrivateNotes,
  buildSharedSummary,
  detectPersonName,
  extractOtherPersonInsights,
  extractOwnerContribution,
  extractRole,
  extractTopics,
  inferFollowUpType,
  segmentSpeechTranscript,
} from "./meeting-context-heuristic.ts";
import { normalizeTranscriptForExtraction } from "./transcript-cleanup.ts";

export type EncounterExtractionDraft = {
  title: string;
  personName: string;
  sharedSummary: string;
  privateNotes: string;
  followUp: string;
  followUpType: Encounter["actions"][number]["channel"];
  uncertainFields?: string[];
};

export type ExtractionOwnerContext = {
  ownerNames: string[];
  ownerEmail?: string;
  recentMeetings?: Array<{
    personName: string;
    privateNotesSample?: string;
    sharedSummarySample?: string;
  }>;
};

export function buildHeuristicDraft(
  transcript: string,
  personName: string,
  ownerContext?: ExtractionOwnerContext,
): EncounterExtractionDraft | null {
  const clean = normalizeTranscriptForExtraction(transcript);
  if (clean.length < 12) return null;

  const ownerNames = ownerContext?.ownerNames ?? [];
  const segments = segmentSpeechTranscript(clean);
  const person = detectPersonName(clean, personName, ownerNames);
  const topics = extractTopics(clean);
  const role = extractRole(clean, person);
  const ownerContribution = extractOwnerContribution(clean);
  const otherPersonInsights = extractOtherPersonInsights({
    transcript: clean,
    personName: person,
    role,
    segments,
    ownerNames,
  });
  const sharedSummary = buildSharedSummary({
    personName: person,
    topics,
    role,
    ownerContribution,
    transcript: clean,
    ownerNames,
  });
  const privateNotes = buildPrivateNotes({
    personName: person,
    role,
    otherPersonInsights,
    topics,
  });
  const followUp = buildFollowUp({ topics, transcript: clean, ownerContribution, personName: person });

  return {
    title: buildMeetingTitle({ personName: person, topics }),
    personName: person,
    sharedSummary,
    privateNotes,
    followUp,
    followUpType: inferFollowUpType(`${followUp} ${clean}`),
  };
}

export function applyExtractionDraft(
  current: {
    title: string;
    personName: string;
    privateNotes: string;
    sharedSummary: string;
    followUp: string;
    followUpType: Encounter["actions"][number]["channel"];
  },
  draft: EncounterExtractionDraft,
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
  ai: "AI draft from your transcript — check names and facts before saving.",
  heuristic: "Suggested draft from your transcript — check names and facts before saving.",
  aiNotConfigured: "Draft generated from your transcript — check names and facts before saving. For richer AI summaries, run vercel link and vercel env pull.",
  aiFallback: "AI summary unavailable — using a structured draft from your transcript. Check names and facts before saving.",
} as const;
