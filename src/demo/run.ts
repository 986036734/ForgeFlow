import { DEMO_GOAL } from "./scenarios.js";
import { runWorkflow, type RunOptions } from "../agent/loop.js";
import type { RunResult } from "../agent/types.js";
import { DEFAULT_MAX_REPAIRS } from "../util/config.js";

export async function runMockDemo(
  options?: Pick<RunOptions, "writeArtifacts" | "repoRoot" | "artifactsDir" | "hitl" | "maxRepairs">,
): Promise<RunResult> {
  return runWorkflow({
    goal: DEMO_GOAL,
    mode: "mock",
    intentionalFirstDraftFail: true,
    hitl: options?.hitl ?? "auto",
    maxRepairs: options?.maxRepairs ?? DEFAULT_MAX_REPAIRS,
    writeArtifacts: options?.writeArtifacts ?? true,
    repoRoot: options?.repoRoot,
    artifactsDir: options?.artifactsDir,
  });
}

export function demoExitCode(result: RunResult): number {
  if (
    result.offline &&
    result.mode === "mock" &&
    result.verdict.pass &&
    result.verdict.repairs === 1 &&
    result.hitl.decision === "approve"
  ) {
    return 0;
  }
  return 1;
}
