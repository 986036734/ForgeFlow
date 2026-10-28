import type { Plan, PlanStep, ToolCallRecord, ToolContext, ToolKind } from "./types.js";
import { collectEvidence } from "./evidence.js";
import { McpError, ToolError } from "../util/errors.js";
import { McpBridge } from "../tools/mcp/bridge.js";
import { getTool } from "../tools/registry.js";
import { draftPrTool } from "../tools/local/draftPr.js";
import { listFilesTool } from "../tools/local/listFiles.js";
import { readReadmeTool } from "../tools/local/readReadme.js";

const localRunners = {
  read_readme: readReadmeTool.run,
  list_files: listFilesTool.run,
  draft_pr: draftPrTool.run,
};

export interface WorkerSession {
  bridge: McpBridge;
  calls: ToolCallRecord[];
  ctx: ToolContext;
  nextId: number;
}

export async function executePlan(plan: Plan, session: WorkerSession): Promise<void> {
  for (const step of plan.steps) {
    if (step.tool === "draft_pr") continue;
    if (step.tool === "get_issue" && typeof step.input.severity === "string") {
      await expandIssues(step, session);
      continue;
    }
    await invokeTool(step.tool, step.input, step.id, session);
  }
}

export async function invokeTool(
  name: string,
  input: Record<string, unknown>,
  stepId: string,
  session: WorkerSession,
): Promise<ToolCallRecord> {
  const definition = getTool(name);
  if (!definition) throw new ToolError(`Unknown tool ${name}`);
  const id = `c${session.nextId++}`;
  try {
    const parsed = definition.schema.parse(input);
    const output = await runTool(definition.name, definition.kind, parsed, session);
    const record: ToolCallRecord = {
      id,
      stepId,
      tool: definition.name,
      kind: definition.kind,
      input: parsed,
      output,
      ok: true,
    };
    if (definition.name === "draft_pr") {
      const draft = output as { intentionalGap?: boolean };
      if (draft.intentionalGap) {
        record.ok = false;
        record.error = "intentional draft-pr FAIL";
      }
    }
    session.calls.push(record);
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const record: ToolCallRecord = {
      id,
      stepId,
      tool: name,
      kind: definition.kind,
      input,
      output: null,
      ok: false,
      error: message,
    };
    session.calls.push(record);
    if (name !== "draft_pr") throw new ToolError(`${name} failed: ${message}`);
    return record;
  }
}

async function expandIssues(step: PlanStep, session: WorkerSession): Promise<void> {
  const evidence = collectEvidence(session.calls);
  const severity = String(step.input.severity);
  const repo = String(step.input.repo ?? "forgeflow");
  const wanted = evidence.issues
    .filter((issue) => issue.state === "open" && issue.severity === severity)
    .sort((a, b) => a.number - b.number);
  if (wanted.length === 0) {
    throw new ToolError(`No open ${severity} issues to fetch`);
  }
  for (const issue of wanted) {
    await invokeTool("get_issue", { repo, number: issue.number }, `${step.id}#${issue.number}`, session);
  }
}

async function runTool(
  name: string,
  kind: ToolKind,
  input: unknown,
  session: WorkerSession,
): Promise<unknown> {
  if (kind === "local") {
    const runner = localRunners[name as keyof typeof localRunners];
    if (!runner) throw new ToolError(`No local runner for ${name}`);
    return runner(input, session.ctx);
  }
  if (!session.bridge) throw new McpError("MCP bridge is not started");
  const args = input as Record<string, unknown>;
  return session.bridge.call(name, args);
}
