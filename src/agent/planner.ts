import type { Plan, PlanStep } from "./types.js";
import { DEMO_REPO, PLAN_ACCEPTANCE } from "../demo/scenarios.js";

export function createPlan(goal: string): Plan {
  const audit = /readme/i.test(goal) && /issue/i.test(goal);
  const steps: PlanStep[] = [
    {
      id: "s1",
      title: "Read README",
      tool: "read_readme",
      kind: "local",
      input: { path: "README.md" },
      purpose: audit
        ? "Ground the draft in the repository's stated goal."
        : "Read the README even when the goal is not the demo audit.",
    },
    {
      id: "s2",
      title: "List repository files",
      tool: "list_files",
      kind: "local",
      input: { depth: 2 },
      purpose: "See which surfaces the checklist can cite.",
    },
    {
      id: "s3",
      title: "List open issues",
      tool: "list_open_issues",
      kind: "mcp",
      input: { repo: DEMO_REPO },
      purpose: "Pull the offline issue set the PR must cite.",
    },
    {
      id: "s4",
      title: "Read high-severity issues",
      tool: "get_issue",
      kind: "mcp",
      input: { repo: DEMO_REPO, severity: "high" },
      purpose: "Load each high-severity issue before drafting.",
    },
    {
      id: "s5",
      title: "Draft PR description",
      tool: "draft_pr",
      kind: "local",
      input: { attempt: 1, goal },
      purpose: "Produce a checkable PR body and checklist.",
    },
  ];
  return { goal, steps, acceptance: [...PLAN_ACCEPTANCE] };
}
