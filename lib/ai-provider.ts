import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

import { isAiGatewayConfigured, refreshAiGatewayAuth } from "./ai-gateway-auth";

function openAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

/** Prefer direct OpenAI so transcription/extraction work without AI Gateway billing. */
export function usesDirectOpenAi() {
  return Boolean(openAiApiKey());
}

export async function isAiConfigured() {
  if (usesDirectOpenAi()) return true;
  return isAiGatewayConfigured();
}

export async function prepareAiAuth() {
  if (usesDirectOpenAi()) {
    return { configured: true, mode: "openai_api_key" as const };
  }
  return refreshAiGatewayAuth();
}

function openAiClient() {
  return createOpenAI({ apiKey: openAiApiKey() });
}

function stripOpenAiPrefix(modelId: string) {
  return modelId.replace(/^openai\//, "").trim();
}

export function transcriptionModel() {
  const configured = process.env.AFTERMEET_TRANSCRIPTION_MODEL?.trim() || "openai/whisper-1";
  if (usesDirectOpenAi()) {
    return openAiClient().transcription(stripOpenAiPrefix(configured) || "whisper-1");
  }
  return configured;
}

export function languageModel() {
  const configured = process.env.AFTERMEET_EXTRACTION_MODEL?.trim() || "openai/gpt-4.1";
  if (usesDirectOpenAi()) {
    return openAiClient()(stripOpenAiPrefix(configured) || "gpt-4.1");
  }
  return configured;
}
