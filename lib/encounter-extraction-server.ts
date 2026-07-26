import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { buildHeuristicDraft, type EncounterExtractionDraft } from "./encounter-extraction";
import { isAiGatewayConfigured, refreshAiGatewayAuth } from "./ai-gateway-auth";
import { normalizeTranscriptForExtraction } from "./transcript-cleanup";

const extractionSchema = z.object({
  title: z.string().describe("Short meeting title, max 120 characters"),
  personName: z.string().describe("Other person's name if clearly stated, otherwise empty string"),
  sharedSummary: z.string().describe("2-3 factual sentences safe to share with the other person"),
  privateNotes: z.string().describe("Owner-only bullet notes. Prefix each line with •"),
  followUp: z.string().describe("One concrete next action sentence, or empty if none"),
  followUpType: z.enum(["email", "linkedin", "call", "meeting", "send", "other"]),
  uncertainFields: z.array(z.string()).describe("Names of fields where the transcript is ambiguous"),
});

function extractionModel() {
  return process.env.AFTERMEET_EXTRACTION_MODEL?.trim() || "openai/gpt-5.4";
}

export async function isAiExtractionConfigured() {
  return isAiGatewayConfigured();
}

export async function extractEncounterDraft(transcript: string, personName: string): Promise<{
  draft: EncounterExtractionDraft;
  source: "ai" | "heuristic";
  uncertainFields: string[];
  fallback?: boolean;
  unavailable?: string;
}> {
  const normalizedTranscript = normalizeTranscriptForExtraction(transcript);
  const heuristic = buildHeuristicDraft(normalizedTranscript, personName);
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
      system: [
        "You extract structured meeting context from live speech transcripts for AfterMeet.",
        "The transcript may contain repeated words, filler, or speech-to-text errors — ignore those.",
        "Never invent contact details, dates, or commitments that are not supported by the transcript.",
        "sharedSummary must be 2-3 factual sentences about what was discussed and agreed.",
        "privateNotes should be concise bullet points prefixed with •.",
        "followUp must be one concrete next action, or empty if none was discussed.",
        "If a person name hint is provided and matches the transcript, prefer it for personName.",
        "Mark uncertainFields when names, dates, amounts, or commitments are ambiguous.",
      ].join(" "),
      prompt: [
        `Person name hint: ${personName || "unknown"}`,
        "",
        "Transcript:",
        normalizedTranscript,
      ].join("\n"),
      temperature: 0.2,
    });

    const output = result.output;
    return {
      draft: {
        title: output.title.trim().slice(0, 160) || heuristic.title,
        personName: output.personName.trim() || personName || heuristic.personName,
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
