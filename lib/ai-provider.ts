import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

import { isAiGatewayConfigured, refreshAiGatewayAuth } from "./ai-gateway-auth";

function openAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

function anthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

function googleSpeechApiKey() {
  return process.env.GOOGLE_STT_API_KEY?.trim() || "";
}

function groqApiKey() {
  return process.env.GROQ_API_KEY?.trim() || "";
}

function transcriptionProvider() {
  return process.env.AFTERMEET_TRANSCRIPTION_PROVIDER?.trim().toLowerCase() || "";
}

/** Temporary test switch: AFTERMEET_TRANSCRIPTION_PROVIDER=google routes audio transcription to Google Cloud Speech-to-Text instead of Whisper (sync recognize, audio capped around 1 minute). */
export function usesGoogleTranscription() {
  return transcriptionProvider() === "google" && Boolean(googleSpeechApiKey());
}

export function googleSpeechConfig() {
  return { apiKey: googleSpeechApiKey() };
}

/** Temporary test switch: AFTERMEET_TRANSCRIPTION_PROVIDER=groq routes audio transcription to Groq's free-tier, OpenAI-compatible Whisper endpoint instead of OpenAI's. */
export function usesGroqTranscription() {
  return transcriptionProvider() === "groq" && Boolean(groqApiKey());
}

export function groqTranscriptionConfig() {
  return {
    apiKey: groqApiKey(),
    model: process.env.AFTERMEET_GROQ_MODEL?.trim() || "whisper-large-v3-turbo",
  };
}

/** Temporary test switch: AFTERMEET_TEXT_PROVIDER=claude routes summaries/extraction/drafts to Claude. Transcription always stays on Whisper — Claude has no audio input. */
export function usesClaudeText() {
  const provider = process.env.AFTERMEET_TEXT_PROVIDER?.trim().toLowerCase();
  return (provider === "claude" || provider === "anthropic") && Boolean(anthropicApiKey());
}

function anthropicClient() {
  return createAnthropic({ apiKey: anthropicApiKey() });
}

/** Claude Opus 5 and later reject non-default temperature — omit it when routed to Claude. */
export function textTemperature(value: number) {
  return usesClaudeText() ? undefined : value;
}

/** Prefer direct OpenAI so transcription/extraction work without AI Gateway billing. */
export function usesDirectOpenAi() {
  return Boolean(openAiApiKey());
}

export async function isAiConfigured() {
  if (usesDirectOpenAi()) return true;
  return isAiGatewayConfigured();
}

export async function isTranscriptionConfigured() {
  if (usesGoogleTranscription() || usesGroqTranscription()) return true;
  return isAiConfigured();
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
  if (usesClaudeText()) {
    const configured = process.env.AFTERMEET_CLAUDE_MODEL?.trim() || "claude-opus-5";
    return anthropicClient()(configured);
  }
  const configured = process.env.AFTERMEET_EXTRACTION_MODEL?.trim() || "openai/gpt-4.1";
  if (usesDirectOpenAi()) {
    return openAiClient()(stripOpenAiPrefix(configured) || "gpt-4.1");
  }
  return configured;
}
