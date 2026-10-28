import { describe, expect, it } from "vitest";
import { decideHitl, runWorkflow } from "../src/agent/loop.js";
import { demoExitCode } from "../src/demo/run.js";
import { DEMO_GOAL } from "../src/demo/scenarios.js";
import { verdictFromAttempts } from "../src/agent/verifier.js";

describe("repair loop", () => {
  it("fails the first draft and passes on repair 1", async () => {
    const result = await runWorkflow({ goal: DEMO_GOAL, writeArtifacts: false });
    expect(result.offline).toBe(true);
    expect(result.attempts.map((attempt) => attempt.pass)).toEqual([false, true]);
    expect(result.verdict.repairs).toBe(1);
    expect(result.verdict.label).toBe("pass");
    expect(result.hitl.decision).toBe("approve");
    expect(result.calls.filter((call) => call.tool === "draft_pr").map((call) => call.ok)).toEqual([false, true]);
    expect(result.calls.some((call) => call.kind === "mcp" && call.tool === "get_issue")).toBe(true);
    expect(demoExitCode(result)).toBe(0);
  });

  it("does not repair when the intentional gap is disabled", async () => {
    const result = await runWorkflow({
      goal: DEMO_GOAL,
      writeArtifacts: false,
      intentionalFirstDraftFail: false,
    });
    expect(result.verdict.pass).toBe(true);
    expect(result.verdict.repairs).toBe(0);
    expect(demoExitCode(result)).toBe(1);
  });

  it("does not repair when the budget is zero", async () => {
    const result = await runWorkflow({
      goal: DEMO_GOAL,
      writeArtifacts: false,
      maxRepairs: 0,
    });
    expect(result.attempts).toHaveLength(1);
    expect(result.verdict.pass).toBe(false);
    expect(result.verdict.repairs).toBe(0);
  });

  it("rejects a repair budget the draft schema cannot represent", async () => {
    await expect(runWorkflow({ goal: DEMO_GOAL, writeArtifacts: false, maxRepairs: 9 })).rejects.toThrow(/0 to 4/);
  });

  it("stops after the repair budget when every draft fails", async () => {
    const result = await runWorkflow({
      goal: DEMO_GOAL,
      writeArtifacts: false,
      forceFailDrafts: true,
      maxRepairs: 1,
    });
    expect(result.verdict.pass).toBe(false);
    expect(result.verdict.repairs).toBe(1);
    expect(result.hitl).toEqual({
      decision: "reject",
      actor: "verifier",
      reason: "draft did not pass the rubric",
    });
  });

  it("lets a deny policy reject a passing verdict", () => {
    const verdict = verdictFromAttempts(
      [{ attempt: 1, draft: {} as never, checks: [], pass: true }],
      0,
    );
    expect(decideHitl("deny", { ...verdict, pass: true, label: "pass" }).decision).toBe("reject");
    expect(decideHitl("auto", { ...verdict, pass: true, label: "pass" }).decision).toBe("approve");
  });
});
