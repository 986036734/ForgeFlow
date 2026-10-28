import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runWorkflow } from "../src/agent/loop.js";
import { collectEvidence } from "../src/agent/evidence.js";
import { verifyAttempt } from "../src/agent/verifier.js";
import type { RubricCheck, ToolCallRecord } from "../src/agent/types.js";
import { groundedDraft } from "../src/tools/local/draftPr.js";
import { loadIssues } from "../src/issues.js";
import { schemaMessage } from "../src/util/errors.js";
import { repoRoot } from "../src/util/paths.js";

export interface EvalResult {
  id: string;
  pass: boolean;
  detail: string;
}

export interface EvalReport {
  ok: boolean;
  results: EvalResult[];
}

const workflowCaseSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("workflow"),
  goal: z.string().min(1),
  expect: z.object({
    verdict: z.enum(["pass", "fail"]),
    repairs: z.number().int().nonnegative(),
    hitl: z.enum(["approve", "reject"]),
    tools: z.array(z.string()),
    kinds: z.array(z.enum(["local", "mcp"])),
  }),
});

const rubricCaseSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("rubric"),
  mutate: z.enum(["drop-rollback", "phantom-issue", "unsupported-claim"]),
  expect: z.object({
    pass: z.boolean(),
    failedChecks: z.array(z.string()),
  }),
});

const evalCaseSchema = z.discriminatedUnion("kind", [workflowCaseSchema, rubricCaseSchema]);

type WorkflowCase = z.infer<typeof workflowCaseSchema>;
type RubricCase = z.infer<typeof rubricCaseSchema>;

export function parseEvalCase(file: string, text: string): { id: string; spec?: WorkflowCase | RubricCase; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { id: file, error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const parsed = evalCaseSchema.safeParse(raw);
  if (!parsed.success) {
    const id =
      raw && typeof raw === "object" && "id" in raw && typeof raw.id === "string" ? raw.id : file;
    return { id, error: schemaMessage(parsed.error) };
  }
  return { id: parsed.data.id, spec: parsed.data };
}

export async function runEvals(root = repoRoot()): Promise<EvalReport> {
  const dir = path.join(root, "evals", "cases");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
  const results: EvalResult[] = [];
  for (const file of files) {
    const loaded = parseEvalCase(file, fs.readFileSync(path.join(dir, file), "utf8"));
    if (!loaded.spec) {
      results.push({ id: loaded.id, pass: false, detail: loaded.error ?? "invalid case" });
      continue;
    }
    results.push(loaded.spec.kind === "workflow" ? await runWorkflowCase(loaded.spec, root) : runRubricCase(loaded.spec, root));
  }
  return { ok: results.every((result) => result.pass), results };
}

async function runWorkflowCase(spec: WorkflowCase, root: string): Promise<EvalResult> {
  const result = await runWorkflow({
    goal: spec.goal,
    writeArtifacts: false,
    repoRoot: root,
    intentionalFirstDraftFail: true,
  });
  const problems: string[] = [];
  if (result.verdict.label !== spec.expect.verdict) problems.push(`verdict ${result.verdict.label}`);
  if (result.verdict.repairs !== spec.expect.repairs) problems.push(`repairs ${result.verdict.repairs}`);
  if (result.hitl.decision !== spec.expect.hitl) problems.push(`hitl ${result.hitl.decision}`);
  const tools = new Set(result.calls.map((call) => call.tool));
  for (const name of spec.expect.tools) {
    if (!tools.has(name)) problems.push(`missing tool ${name}`);
  }
  const kinds = new Set(result.calls.map((call) => call.kind));
  for (const kind of spec.expect.kinds) {
    if (!kinds.has(kind)) problems.push(`missing kind ${kind}`);
  }
  return { id: spec.id, pass: problems.length === 0, detail: problems.join(", ") || "ok" };
}

function runRubricCase(spec: RubricCase, root: string): EvalResult {
  const { checks, pass } = mutatedChecks(spec.mutate, root);
  const failed = checks.filter((check) => !check.pass).map((check) => check.id);
  const samePass = pass === spec.expect.pass;
  const sameChecks = failed.join(",") === spec.expect.failedChecks.join(",");
  return {
    id: spec.id,
    pass: samePass && sameChecks,
    detail: samePass && sameChecks ? "ok" : `got pass=${pass} [${failed.join(", ")}]`,
  };
}

function mutatedChecks(mutate: RubricCase["mutate"], root: string): { checks: RubricCheck[]; pass: boolean } {
  const readme = "ForgeFlow turns one sentence into a checkable tool workflow for judges.";
  const calls: ToolCallRecord[] = [
    {
      id: "c1",
      stepId: "s1",
      tool: "read_readme",
      kind: "local",
      input: { path: "README.md" },
      output: { path: "README.md", text: readme, bytes: readme.length },
      ok: true,
    },
    {
      id: "c2",
      stepId: "s2",
      tool: "list_files",
      kind: "local",
      input: { depth: 1 },
      output: { files: ["DEMO.md", "src/cli.ts"] },
      ok: true,
    },
    {
      id: "c3",
      stepId: "s3",
      tool: "list_open_issues",
      kind: "mcp",
      input: { repo: "forgeflow" },
      output: { repo: "forgeflow", issues: loadIssues(path.join(root, "fixtures", "issues.json")) },
      ok: true,
    },
  ];
  const draft = groundedDraft("Audit the README and open issues.", 2, calls);
  if (mutate === "drop-rollback") {
    draft.checklist = draft.checklist.filter((item) => !item.toLowerCase().includes("rollback"));
  } else if (mutate === "phantom-issue") {
    draft.issues.push({ number: 999, note: "This issue is not in the tool corpus." });
  } else if (mutate === "unsupported-claim") {
    draft.claims.push("All CI checks are already green and this change has zero risk.");
  } else {
    const unexpected: never = mutate;
    throw new Error(`Unknown rubric mutation: ${String(unexpected)}`);
  }
  const record = verifyAttempt(draft, collectEvidence(calls), calls);
  return { checks: record.checks, pass: record.pass };
}
