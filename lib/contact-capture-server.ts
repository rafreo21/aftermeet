import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { refreshAiGatewayAuth } from "./ai-gateway-auth";
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

export async function enrichCapturedProfile(profile: CapturedProfile, pageText: string) {
  await refreshAiGatewayAuth();

  const result = await generateText({
    model: captureModel(),
    output: Output.object({ schema: captureSchema }),
    system: [
      "You normalize contact details captured from a web page for AfterMeet.",
      "Only use facts present in the supplied profile or page text.",
      "Never invent email addresses or phone numbers.",
      "companyWebsite is the employer's site. personalWebsite is the person's portfolio or personal site.",
      "Mark uncertainFields when a value is inferred rather than explicit.",
    ].join(" "),
    prompt: [
      "Captured profile JSON:",
      JSON.stringify(profile, null, 2),
      "",
      "Visible page text:",
      pageText.slice(0, 6000),
    ].join("\n"),
    temperature: 0.1,
  });

  return {
    profile: {
      ...profile,
      ...result.output,
      linkedinUrl: profile.linkedinUrl,
      sourceUrl: profile.sourceUrl,
      source: profile.source,
    },
    uncertainFields: result.output.uncertainFields ?? [],
  };
}
