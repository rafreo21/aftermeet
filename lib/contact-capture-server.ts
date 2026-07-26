import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { refreshAiGatewayAuth } from "./ai-gateway-auth";
import { buildLinkedInCaptureContext } from "./linkedin-page-capture.ts";
import type { CapturedProfile } from "./page-profile-capture";

const captureSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  company: z.string(),
  role: z.string(),
  companyWebsite: z.string(),
  personalWebsite: z.string(),
  uncertainFields: z.array(z.string()),
});

function captureModel() {
  return process.env.AFTERMEET_EXTRACTION_MODEL?.trim() || "openai/gpt-5.4";
}

function shouldKeepOriginalValue(field: keyof CapturedProfile, original: string, enriched: string) {
  if (!enriched.trim()) return true;
  if (!original.trim()) return false;
  if (field === "company" && (enriched.length > 80 || /manage, lead|responsible for|^[•-]/i.test(enriched))) return true;
  if (field === "role" && /global talent|open to work|verified/i.test(enriched)) return true;
  if ((field === "email" || field === "phone") && original.trim()) return true;
  return false;
}

function mergeEnrichedProfile(original: CapturedProfile, enriched: z.infer<typeof captureSchema>) {
  const merged: CapturedProfile = {
    ...original,
    ...enriched,
    linkedinUrl: original.linkedinUrl,
    sourceUrl: original.sourceUrl,
    source: original.source,
  };

  (["firstName", "lastName", "email", "phone", "role", "company", "companyWebsite", "personalWebsite"] as const).forEach((field) => {
    if (shouldKeepOriginalValue(field, original[field], enriched[field])) {
      merged[field] = original[field];
    }
  });

  merged.context = original.context || buildLinkedInCaptureContext(merged);
  return merged;
}

export async function enrichCapturedProfile(profile: CapturedProfile, pageText: string) {
  await refreshAiGatewayAuth();

  const result = await generateText({
    model: captureModel(),
    output: Output.object({ schema: captureSchema }),
    system: [
      "You normalize LinkedIn profile captures for AfterMeet.",
      "Use the Experience section for the current role and employer only. Ignore older jobs.",
      "Use the Contact info section for email and phone when present.",
      "Never invent email addresses or phone numbers.",
      "Do not put job descriptions into the company field.",
      "companyWebsite is the employer's site. personalWebsite is the person's portfolio or personal site.",
      "Mark uncertainFields when a value is inferred rather than explicit.",
    ].join(" "),
    prompt: [
      "Captured profile JSON:",
      JSON.stringify(profile, null, 2),
      "",
      "Visible page text:",
      pageText.slice(0, 8000),
    ].join("\n"),
    temperature: 0.1,
  });

  return {
    profile: mergeEnrichedProfile(profile, result.output),
    uncertainFields: result.output.uncertainFields ?? [],
  };
}
