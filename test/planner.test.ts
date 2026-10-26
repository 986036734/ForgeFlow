import { describe, expect, it } from "vitest";
import { createPlan } from "../src/agent/planner.js";
import { DEMO_GOAL } from "../src/demo/scenarios.js";

describe("planner", () => {
  it("orders the demo audit into local and mcp steps", () => {
    const plan = createPlan(DEMO_GOAL);
    expect(plan.steps.map((step) => step.tool)).toEqual([
      "read_readme",
      "list_files",
      "list_open_issues",
      "get_issue",
      "draft_pr",
    ]);
    expect(plan.steps.map((step) => step.kind)).toEqual(["local", "local", "mcp", "mcp", "local"]);
    expect(plan.acceptance.length).toBeGreaterThanOrEqual(4);
  });

  it("still assigns tagged tools when the goal is not the demo sentence", () => {
    const plan = createPlan("Summarize the repository for a new teammate");
    expect(plan.steps.every((step) => step.kind === "local" || step.kind === "mcp")).toBe(true);
    expect(plan.steps.map((step) => step.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });
});
