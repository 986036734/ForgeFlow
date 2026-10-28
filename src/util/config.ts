import type { HitlPolicy, RunMode } from "../agent/types.js";
import { ConfigError } from "./errors.js";

export interface ForgeConfig {
  mode: RunMode;
  maxRepairs: number;
  hitl: HitlPolicy;
  goal: string;
  writeArtifacts: boolean;
}

export const DEFAULT_MAX_REPAIRS = 2;

/** Attempt 1 plus repairs must stay inside the draft schema, which allows attempts 1 through 5. */
export const MAX_REPAIRS_CAP = 4;

export function loadConfig(overrides: Partial<ForgeConfig> = {}): ForgeConfig {
  return {
    mode: overrides.mode ?? readMode(),
    maxRepairs: overrides.maxRepairs ?? readMaxRepairs(),
    hitl: overrides.hitl ?? readHitl(),
    goal: overrides.goal ?? "",
    writeArtifacts: overrides.writeArtifacts ?? true,
  };
}

function readMode(): RunMode {
  const raw = process.env.FORGEFLOW_MODE;
  if (raw === undefined || raw === "" || raw === "mock") return "mock";
  if (raw === "live") return "live";
  throw new ConfigError("FORGEFLOW_MODE must be mock or live");
}

function readHitl(): HitlPolicy {
  const raw = process.env.FORGEFLOW_HITL;
  if (raw === undefined || raw === "" || raw === "auto") return "auto";
  if (raw === "deny") return "deny";
  throw new ConfigError("FORGEFLOW_HITL must be auto or deny");
}

function readMaxRepairs(): number {
  const raw = process.env.FORGEFLOW_MAX_REPAIRS;
  if (raw === undefined || raw === "") return DEFAULT_MAX_REPAIRS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_REPAIRS_CAP) {
    throw new ConfigError(`FORGEFLOW_MAX_REPAIRS must be an integer from 0 to ${MAX_REPAIRS_CAP}`);
  }
  return parsed;
}
