import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectEvidence } from "../src/agent/evidence.js";
import { verifyAttempt } from "../src/agent/verifier.js";
import type { ToolCallRecord } from "../src/agent/types.js";
import { groundedDraft, intentionalGapDraft } from "../src/tools/local/draftPr.js";
import { loadIssues } from "../src/issues.js";
import { repoRoot } from "../src/util/paths.js";
import { checkCoverage } from "../src/verify/coverage.js";

const readme = "ForgeFlow turns one sentence into a checkable tool workflow for judges.";

function calls(): ToolCallRecord[] {
  return [
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
      output: { repo: "forgeflow", issues: loadIssues(path.join(repoRoot(), "fixtures", "issues.json")) },
      ok: true,
    },
  ];
}

describe("rubric and coverage", () => {
  it("rejects a tool payload that does not match the schema", () => {
    const sample = calls();
    sample[0] = { ...sample[0], output: { path: "README.md" } };
    expect(() => collectEvidence(sample)).toThrow(/unexpected payload/);
  });

  it("rejects the intentional gap draft", () => {
    const sample = calls();
    const record = verifyAttempt(intentionalGapDraft(1), collectEvidence(sample), sample);
    expect(record.pass).toBe(false);
    const failed = record.checks.filter((check) => !check.pass).map((check) => check.id);
    expect(failed).toEqual(
      expect.arrayContaining(["summary-quote", "issue-citations", "checklist-gates", "evidence-map", "coverage", "no-gap"]),
    );
  });

  it("accepts a draft grounded in the tool corpus", () => {
    const sample = calls();
    const record = verifyAttempt(groundedDraft("Audit the README and open issues.", 2, sample), collectEvidence(sample), sample);
    expect(record.pass).toBe(true);
    expect(record.checks.map((check) => check.id)).toHaveLength(7);
  });

  it("fails only the checklist when rollback is missing", () => {
    const sample = calls();
    const draft = groundedDraft("Audit the README and open issues.", 2, sample);
    draft.checklist = draft.checklist.filter((item) => !item.toLowerCase().includes("rollback"));
    const record = verifyAttempt(draft, collectEvidence(sample), sample);
    expect(record.checks.filter((check) => !check.pass).map((check) => check.id)).toEqual(["checklist-gates"]);
  });

  it("fails only issue citations when a phantom issue is added", () => {
    const sample = calls();
    const draft = groundedDraft("Audit the README and open issues.", 2, sample);
    draft.issues.push({ number: 999, note: "not in the corpus" });
    const record = verifyAttempt(draft, collectEvidence(sample), sample);
    expect(record.checks.filter((check) => !check.pass).map((check) => check.id)).toEqual(["issue-citations"]);
  });

  it("flags a claim that is not in the corpus", () => {
    const report = checkCoverage(
      ["ForgeFlow turns one sentence into a checkable tool workflow for judges.", "invented metric"],
      [readme],
    );
    expect(report.pass).toBe(false);
    expect(report.results[1]?.supported).toBe(false);
  });
});
