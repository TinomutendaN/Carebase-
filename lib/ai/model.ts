import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/** The one place the model is chosen. Switch providers with AI_PROVIDER. */

export type AiProvider = "openai" | "anthropic";

const settings = {
  openai: { keyVar: "OPENAI_API_KEY", modelVar: "OPENAI_MODEL", create: openai },
  anthropic: { keyVar: "ANTHROPIC_API_KEY", modelVar: "ANTHROPIC_MODEL", create: anthropic },
} as const;

export function getProvider(): AiProvider {
  const value = (process.env.AI_PROVIDER || "openai").trim().toLowerCase();
  if (value !== "openai" && value !== "anthropic") {
    throw new Error(`AI_PROVIDER must be "openai" or "anthropic", got "${value}".`);
  }
  return value;
}

export function getModelName(provider: AiProvider = getProvider()): string | undefined {
  return process.env[settings[provider].modelVar]?.trim() || undefined;
}

/** True when the chosen provider's API key is set. Never returns the key. */
export function isModelKeySet(provider: AiProvider = getProvider()): boolean {
  return Boolean(process.env[settings[provider].keyVar]?.trim());
}

export function getModel(): LanguageModel {
  const provider = getProvider();
  const name = getModelName(provider);
  if (!name) {
    throw new Error(`${settings[provider].modelVar} is not set.`);
  }
  return settings[provider].create(name);
}
