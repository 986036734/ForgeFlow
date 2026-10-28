import type { HitlDecision, HitlPolicy, RunMode, RunResult, ToolContext, Verdict } from "./types.js";
import { createPlan } from "./planner.js";
import { verifyAttempt, verdictFromAttempts } from "./verifier.js";
import { collectEvidence } from "./evidence.js";
import { executePlan, invokeTool, type WorkerSession } from "./worker.js";
import { McpBridge } from "../tools/mcp/bridge.js";
import { writeArtifacts } from "../util/report.js";
import { artifactsDir as defaultArtifactsDir, repoRoot as defaultRoot } from "../util/paths.js";
import { DEFAULT_MAX_REPAIRS, MAX_REPAIRS_CAP } from "../util/config.js";
import { ToolError } from "../util/errors.js";
import { parsePrDraft } from "../tools/local/draftPr.js";

export interface RunOptions {
  goal: string;
  mode?: RunMode;
  maxRepairs?: number;
  hitl?: HitlPolicy;
  intentionalFirstDraftFail?: boolean;
  forceFailDrafts?: boolean;
  writeArtifacts?: boolean;
  artifactsDir?: string;
  repoRoot?: string;
}

export async function runWorkflow(options: RunOptions): Promise<RunResult> {
  const mode = options.mode ?? "mock";
  if (mode !== "mock") {
    throw new ToolError("runWorkflow is the offline mock loop. Use runLive for OpenAI.");
  }
  const root = options.repoRoot ?? defaultRoot();
  const maxRepairs = options.maxRepairs ?? DEFAULT_MAX_REPAIRS;
  if (!Number.isInteger(maxRepairs) || maxRepairs < 0 || maxRepairs > MAX_REPAIRS_CAP) {
    throw new ToolError(`maxRepairs must be an integer from 0 to ${MAX_REPAIRS_CAP}`);
  }
  const policy = options.hitl ?? "auto";
  const calls: RunResult["calls"] = [];
  const ctx: ToolContext = {
    repoRoot: root,
    goal: options.goal,
    calls,
    intentionalFirstDraftFail: options.intentionalFirstDraftFail ?? true,
    forceFailDrafts: options.forceFailDrafts ?? false,
  };
  const bridge = new McpBridge(root);
  const session: WorkerSession = { bridge, calls, ctx, nextId: 1 };
  const plan = createPlan(options.goal);
  try {
    await bridge.start();
    await executePlan(plan, session);
    const attempts = [];
    let repairs = 0;
    const maxAttempts = maxRepairs + 1;
    while (attempts.length < maxAttempts) {
      const attempt = attempts.length + 1;
      const stepId = attempt === 1 ? "s5" : `s5-r${attempt - 1}`;
      const call = await invokeTool("draft_pr", { attempt, goal: options.goal }, stepId, session);
      if (!call.output || typeof call.output !== "object") {
        throw new ToolError(call.error ?? "draft_pr returned no draft");
      }
      const draft = parsePrDraft(call.output);
      const evidence = collectEvidence(calls);
      const record = verifyAttempt(draft, evidence, calls);
      attempts.push(record);
      if (record.pass) break;
      if (attempts.length >= maxAttempts) break;
      repairs += 1;
    }
    const verdict = verdictFromAttempts(attempts, repairs);
    const hitl = decideHitl(policy, verdict);
    const result: RunResult = {
      goal: options.goal,
      mode: "mock",
      offline: true,
      plan,
      calls,
      attempts,
      evidence: collectEvidence(calls),
      verdict,
      hitl,
    };
    if (options.writeArtifacts) {
      await writeArtifacts(result, options.artifactsDir ?? defaultArtifactsDir(root));
    }
    return result;
  } finally {
    await bridge.close();
  }
}

export function decideHitl(policy: HitlPolicy, verdict: Verdict): HitlDecision {
  if (!verdict.pass) {
    return {
      decision: "reject",
      actor: "verifier",
      reason: "draft did not pass the rubric",
    };
  }
  if (policy === "deny") {
    return {
      decision: "reject",
      actor: "hitl",
      reason: "human gate denied the draft",
    };
  }
  return {
    decision: "approve",
    actor: "mock-auto",
    reason: "verifier pass under the auto policy",
  };
}
