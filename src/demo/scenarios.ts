export const DEMO_GOAL =
  "Audit the repo README and open issues, then draft a PR description and checklist.";

export const DEMO_REPO = "forgeflow";

export const REQUIRED_GATES = ["tests", "docs", "risk", "rollback"] as const;

export type GateId = (typeof REQUIRED_GATES)[number];

export const GATE_LINES: Record<GateId, string> = {
  tests: "Tests cover the verifier rubric and the mock repair loop",
  docs: "Docs point judges at DEMO.md and the stdio MCP server",
  risk: "Risk: live OpenAI calls can fail on geo-blocked networks, including mainland China",
  rollback: "Rollback: revert the PR; the mock path has no external side effects",
};

export const PLAN_ACCEPTANCE = [
  "The draft quotes a README line returned by read_readme",
  "Every high-severity open issue number is cited",
  "The checklist covers tests, docs, risk, and rollback",
  "The evidence map names a local tool call and an mcp tool call",
  "Every claim is a substring of the tool corpus",
];
