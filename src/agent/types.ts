export type ToolKind = "local" | "mcp";

export type RunMode = "mock" | "live";

export type HitlPolicy = "auto" | "deny";

export interface PlanStep {
  id: string;
  title: string;
  tool: string;
  kind: ToolKind;
  input: Record<string, unknown>;
  purpose: string;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  acceptance: string[];
}

export interface ToolCallRecord {
  id: string;
  stepId: string;
  tool: string;
  kind: ToolKind;
  input: unknown;
  output: unknown;
  ok: boolean;
  error?: string;
}

export interface Issue {
  number: number;
  title: string;
  body: string;
  severity: "high" | "medium" | "low";
  state: "open" | "closed";
  labels: string[];
}

export interface ReadmeOutput {
  path: string;
  text: string;
  bytes: number;
}

export interface FilesOutput {
  files: string[];
}

export interface IssuesOutput {
  repo: string;
  issues: Issue[];
}

export interface IssueOutput {
  repo: string;
  issue: Issue;
}

export interface EvidenceRef {
  callId: string;
  tool: string;
  kind: ToolKind;
  supports: string;
}

export interface PrDraft {
  title: string;
  summary: string;
  readmeFindings: string[];
  issues: Array<{ number: number; note: string }>;
  checklist: string[];
  evidence: EvidenceRef[];
  claims: string[];
  attempt: number;
  intentionalGap: boolean;
}

export interface RubricCheck {
  id: string;
  pass: boolean;
  detail: string;
}

export interface AttemptRecord {
  attempt: number;
  draft: PrDraft;
  checks: RubricCheck[];
  pass: boolean;
}

export interface Verdict {
  pass: boolean;
  label: "pass" | "fail";
  score: number;
  repairs: number;
  summary: string;
}

export interface HitlDecision {
  decision: "approve" | "reject";
  actor: string;
  reason: string;
}

export interface EvidenceBundle {
  readmePath: string;
  readme: string;
  files: string[];
  issues: Issue[];
  corpus: string[];
}

export interface RunResult {
  goal: string;
  mode: RunMode;
  offline: boolean;
  plan: Plan;
  calls: ToolCallRecord[];
  attempts: AttemptRecord[];
  evidence: EvidenceBundle;
  verdict: Verdict;
  hitl: HitlDecision;
}

export interface ToolContext {
  repoRoot: string;
  goal: string;
  calls: ToolCallRecord[];
  intentionalFirstDraftFail: boolean;
  forceFailDrafts: boolean;
}
