import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import {
  buildHeuristicDraft,
  type EncounterExtractionDraft,
  type ExtractionOwnerContext,
} from "./encounter-extraction";
import { isAiGatewayConfigured, refreshAiGatewayAuth } from "./ai-gateway-auth";
import { normalizeTranscriptForExtraction } from "./transcript-cleanup";

const extractionSchema = z.object({
  title: z.string().describe("Short meeting title, max 120 characters"),
  personName: z.string().describe("The other person's name from the conversation — never the recording owner"),
  sharedSummary: z.string().describe("2-4 neutral sentences describing what both people discussed and agreed, safe to share"),
  privateNotes: z.string().describe("Owner-only bullets about what the other person said that matters — prefix each line with •"),
  followUp: z.string().describe("One concrete next action sentence, or empty if none"),
  followUpType: z.enum(["email", "linkedin", "call", "meeting", "send", "other"]),
  uncertainFields: z.array(z.string()).describe("Field names where the transcript is ambiguous"),
});

function extractionModel() {
  return process.env.AFTERMEET_EXTRACTION_MODEL?.trim() || "openai/gpt-5.4";
}

function formatOwnerContext(context?: ExtractionOwnerContext) {
  if (!context) return "Recording owner: unknown";

  const lines = [
    `Recording owner (me): ${context.ownerNames.join(" / ") || "unknown"}`,
    context.ownerEmail ? `Owner email: ${context.ownerEmail}` : "",
  ].filter(Boolean);

  if (context.recentMeetings?.length) {
    lines.push("", "Recent meetings by this owner (match tone and bullet style, do not copy facts):");
    context.recentMeetings.forEach((meeting, index) => {
      lines.push(
        `${index + 1}. With ${meeting.personName || "someone"}:`,
        meeting.sharedSummarySample ? `   Shared summary sample: ${meeting.sharedSummarySample}` : "",
        meeting.privateNotesSample ? `   Private notes sample: ${meeting.privateNotesSample}` : "",
      );
    });
  }

  return lines.filter(Boolean).join("\n");
}

function buildExtractionSystemPrompt(context?: ExtractionOwnerContext) {
  const ownerLabel = context?.ownerNames?.[0] ?? "the recording owner";

  return [
    "You are AfterMeet's meeting intelligence engine.",
    "The transcript is from a live conversation recorded by the owner (me). There is no speaker diarization — infer who said what from introductions, names, and first-person cues.",
    `Treat I/me/my as ${ownerLabel} unless the transcript clearly indicates otherwise.`,
    "",
    "PRIVATE NOTES (owner-only — never share with the other person):",
    "- Capture what the OTHER PERSON said that is worth remembering: their priorities, constraints, commitments, concerns, numbers, deadlines, preferences, and direct quotes when useful.",
    "- Do not restate the owner's own plans unless the other person explicitly asked for them.",
    "- Use concise bullet points prefixed with • (3-6 bullets).",
    "",
    "SHARED SUMMARY (safe to send to the other person):",
    "- A neutral, factual account of what BOTH people discussed and agreed.",
    "- Use we for joint decisions. Attribute individual commitments clearly (e.g. \"Alex will…\", \"I will…\").",
    "- 2-4 sentences. No private judgments or impressions.",
    "",
    "PERSON NAME:",
    "- personName must be the other person — never the recording owner.",
    "- Extract their name from the conversation when stated (e.g. introductions, \"I'm here with…\", \"meeting with…\").",
    "- Use the person name hint only when it matches transcript evidence.",
    "- When email or phone hints are provided, use them only for personName disambiguation — never copy them into notes unless spoken in the transcript.",
    "",
    "TRANSCRIPT QUALITY:",
    "- Input is raw speech-to-text: missing punctuation, false starts, homophones, and repeated fragments are common.",
    "- Reconstruct intended meaning before writing outputs. Turn fragments into clear, sensible sentences.",
    "- Never copy gibberish or obvious STT errors verbatim — infer the most likely intended words from context.",
    "",
    "SEPARATION (critical):",
    "- privateNotes and sharedSummary must not overlap. If a fact belongs in one, it must not appear in the other.",
    "- privateNotes = ONLY what the other person said or committed to (their side).",
    "- sharedSummary = ONLY what both parties discussed or agreed (neutral, mutual record).",
    "",
    "QUALITY:",
    "- Ignore filler, repeated words, and speech-to-text errors.",
    "- Never invent contact details, dates, amounts, or commitments not supported by the transcript.",
    "- Mark uncertainFields when names, dates, amounts, or commitments are ambiguous.",
    "- Match the owner's note style from recent meetings when examples are provided.",
  ].join("\n");
}

function buildExtractionPrompt(
  normalizedTranscript: string,
  personName: string,
  context?: ExtractionOwnerContext,
  personHints?: { personEmail?: string; personPhone?: string },
) {
  const hintLines = [
    `Other person name hint: ${personName || "unknown — detect from transcript"}`,
    personHints?.personEmail ? `Other person email (confirmed by owner): ${personHints.personEmail}` : "",
    personHints?.personPhone ? `Other person phone (confirmed by owner): ${personHints.personPhone}` : "",
  ].filter(Boolean);

  return [
    formatOwnerContext(context),
    "",
    ...hintLines,
    "",
    "Transcript:",
    normalizedTranscript,
  ].join("\n");
}

export async function isAiExtractionConfigured() {
  return isAiGatewayConfigured();
}

export async function extractEncounterDraft(
  transcript: string,
  personName: string,
  ownerContext?: ExtractionOwnerContext,
  personHints?: { personEmail?: string; personPhone?: string },
): Promise<{
  draft: EncounterExtractionDraft;
  source: "ai" | "heuristic";
  uncertainFields: string[];
  fallback?: boolean;
  unavailable?: string;
}> {
  const normalizedTranscript = normalizeTranscriptForExtraction(transcript);
  const heuristic = buildHeuristicDraft(normalizedTranscript, personName, ownerContext);
  if (!heuristic) {
    throw new Error("Transcript is too short to extract meeting context.");
  }

  if (!(await isAiExtractionConfigured())) {
    return {
      draft: heuristic,
      source: "heuristic",
      uncertainFields: [],
      unavailable: "ai_not_configured",
    };
  }

  await refreshAiGatewayAuth();

  try {
    const result = await generateText({
      model: extractionModel(),
      output: Output.object({ schema: extractionSchema }),
      system: buildExtractionSystemPrompt(ownerContext),
      prompt: buildExtractionPrompt(normalizedTranscript, personName, ownerContext, personHints),
      temperature: 0.2,
    });

    const output = result.output;
    const ownerNames = new Set((ownerContext?.ownerNames ?? []).map((name) => name.toLowerCase()));
    let resolvedPersonName = output.personName.trim() || personName || heuristic.personName;
    if (ownerNames.has(resolvedPersonName.toLowerCase())) {
      resolvedPersonName = heuristic.personName || personName;
    }

    return {
      draft: {
        title: output.title.trim().slice(0, 160) || heuristic.title,
        personName: resolvedPersonName,
        sharedSummary: output.sharedSummary.trim() || heuristic.sharedSummary,
        privateNotes: output.privateNotes.trim() || heuristic.privateNotes,
        followUp: output.followUp.trim(),
        followUpType: output.followUpType,
      },
      source: "ai",
      uncertainFields: output.uncertainFields ?? [],
    };
  } catch {
    return {
      draft: heuristic,
      source: "heuristic",
      uncertainFields: [],
      fallback: true,
    };
  }
}
