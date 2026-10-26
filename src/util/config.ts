import type { HitlPolicy, RunMode } from "../agent/types.js";

export interface ForgeConfig {
  mode: RunMode;
  maxRepairs: number;
  hitl: HitlPolicy;
  goal: string;
  writeArtifacts: boolean;
}

export const DEFAULT_MAX_REPAIRS = 2;

export function loadConfig(overrides: Partial<ForgeConfig> = {}): ForgeConfig {
  const modeEnv = process.env.FORGEFLOW_MODE === "live" ? "live" : "mock";
  const hitlEnv = process.env.FORGEFLOW_HITL === "deny" ? "deny" : "auto";
  const parsedRepairs = Number(process.env.FORGEFLOW_MAX_REPAIRS ?? DEFAULT_MAX_REPAIRS);
  const maxRepairs = Number.isInteger(parsedRepairs) && parsedRepairs >= 0 ? parsedRepairs : DEFAULT_MAX_REPAIRS;
  return {
    mode: overrides.mode ?? modeEnv,
    maxRepairs: overrides.maxRepairs ?? maxRepairs,
    hitl: overrides.hitl ?? hitlEnv,
    goal: overrides.goal ?? "",
    writeArtifacts: overrides.writeArtifacts ?? true,
  };
}
