import { ConfigError } from "../util/errors.js";

/** Matches the default model pinned by @openai/agents 0.21 in this repo. */
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

export const MISSING_KEY_MESSAGE =
  "OPENAI_API_KEY is not set. pnpm demo uses the offline mock without a key; pnpm demo:live needs a key in the environment.";

export type RequestedDemoMode = "auto" | "mock" | "live";

export interface DemoModeDecision {
  mode: "mock" | "live";
  model: string;
  banner: string;
  fallback: boolean;
}

export function normalizeApiKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveOpenAIModel(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : DEFAULT_OPENAI_MODEL;
}

export function selectDemoMode(input: {
  requested: RequestedDemoMode;
  apiKey: string | undefined;
  model?: string | undefined;
}): DemoModeDecision {
  const model = resolveOpenAIModel(input.model);
  const apiKey = normalizeApiKey(input.apiKey);
  if (input.requested === "mock") {
    return { mode: "mock", model, banner: "demo mode: mock", fallback: false };
  }
  if (input.requested === "live") {
    if (!apiKey) throw new ConfigError(MISSING_KEY_MESSAGE);
    return { mode: "live", model, banner: liveBanner(model), fallback: false };
  }
  if (input.requested !== "auto") {
    throw new ConfigError("mode must be auto, mock, or live");
  }
  if (apiKey) {
    return { mode: "live", model, banner: liveBanner(model), fallback: false };
  }
  return {
    mode: "mock",
    model,
    banner: "demo mode: mock (offline fallback; OPENAI_API_KEY is not set)",
    fallback: true,
  };
}

function liveBanner(model: string): string {
  return `demo mode: live (OpenAI Responses API, model ${model})`;
}
