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
  title: z.string().describe("Short meeting title, max 120 characters. For group meetings, describe the meeting not one person."),
  personName: z.string().describe("Primary attendee name if one person, or a short group label like 'Alex, Jordan, and Sam'"),
  sharedSummary: z.string().describe("3-6 intelligent sentences summarizing what was discussed, decided, and who owns what next. Safe to share with everyone in the meeting."),
  privateNotes: z.string().describe("Leave empty."),
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
    "The owner already captured attendees separately. Focus on a strong meeting title and an intelligent share summary.",
    "",
    "MEETING TITLE:",
    "- Short, specific, and useful in a meeting list.",
    "- For group meetings, name the meeting topic or group — not just one attendee.",
    "",
    "SHARE SUMMARY (the main output):",
    "- A clear, shareable recap of what was discussed, decided, blocked, and agreed.",
    "- Attribute commitments clearly when multiple people are involved.",
    "- Use we for joint decisions. Name people when they took ownership.",
    "- 3-6 sentences. Write like a sharp human assistant, not a transcript dump.",
    "- Safe to send to everyone who was in the room.",
    "",
    "GROUP MEETINGS:",
    "- When multiple attendees are provided, reflect the group dynamic in title and summary.",
    "- Do not collapse a multi-person meeting into a 1:1 summary.",
    "",
    "PERSON NAME FIELD:",
    "- Return a short attendee label for legacy storage.",
    "- Prefer the confirmed attendee list when provided; otherwise infer from the transcript.",
    "- Never use the recording owner as personName.",
    "",
    "PRIVATE NOTES:",
    "- Always return an empty string.",
    "",
    "TRANSCRIPT QUALITY:",
    "- Input is raw speech-to-text: missing punctuation, false starts, homophones, and repeated fragments are common.",
    "- Reconstruct intended meaning before writing outputs. Never copy gibberish verbatim.",
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
  personHints?: {
    personEmail?: string;
    personPhone?: string;
    people?: Array<{ name: string; email?: string; phone?: string }>;
  },
) {
  const attendeeLines = personHints?.people?.length
    ? personHints.people.map((person, index) => {
        const details = [person.email, person.phone].filter(Boolean).join(" · ");
        return `${index + 1}. ${person.name}${details ? ` (${details})` : ""}`;
      })
    : [];

  const hintLines = [
    attendeeLines.length ? `Confirmed attendees:\n${attendeeLines.join("\n")}` : `Attendee hint: ${personName || "unknown — detect from transcript"}`,
    personHints?.personEmail ? `Primary email hint: ${personHints.personEmail}` : "",
    personHints?.personPhone ? `Primary phone hint: ${personHints.personPhone}` : "",
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
  personHints?: {
    personEmail?: string;
    personPhone?: string;
    people?: Array<{ name: string; email?: string; phone?: string }>;
  },
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
        privateNotes: "",
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
