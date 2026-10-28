import type { RunResult } from "../agent/types.js";
import { issueOutputSchema } from "../tools/schemas.js";

export type TraceTone = "neutral" | "local" | "mcp" | "fail" | "pass" | "repair";

export interface TraceEvent {
  index: number;
  phase: "plan" | "tool" | "verify" | "repair" | "hitl";
  tone: TraceTone;
  title: string;
  detail: string;
}

export function buildTrace(result: RunResult): TraceEvent[] {
  const events: TraceEvent[] = [];
  const push = (event: Omit<TraceEvent, "index">) => {
    events.push({ index: events.length + 1, ...event });
  };

  for (const step of result.plan.steps) {
    push({
      phase: "plan",
      tone: step.kind === "mcp" ? "mcp" : "local",
      title: `${step.tool} [${step.kind}] ${step.title}`,
      detail: step.purpose,
    });
  }

  let seenDrafts = 0;
  for (const call of result.calls) {
    if (call.tool === "draft_pr") {
      seenDrafts += 1;
      const attempt = result.attempts[seenDrafts - 1];
      push({
        phase: "tool",
        tone: call.ok ? "pass" : "fail",
        title: call.ok ? "tool draft_pr (local) ok" : "tool draft_pr (local) intentional draft-pr FAIL",
        detail: call.ok ? "Grounded draft from the tool corpus." : "First draft omits quotes, issue numbers, and checklist gates.",
      });
      if (attempt) {
        const failed = attempt.checks.filter((check) => !check.pass).map((check) => check.id);
        push({
          phase: "verify",
          tone: attempt.pass ? "pass" : "fail",
          title: attempt.pass ? "verifier PASS" : "verifier FAIL",
          detail: attempt.pass ? "All rubric checks passed." : failed.join(", "),
        });
        if (!attempt.pass && seenDrafts < result.attempts.length) {
          push({
            phase: "repair",
            tone: "repair",
            title: `repair ${seenDrafts}`,
            detail: "Draft again from README quotes and MCP issue records.",
          });
        }
      }
      continue;
    }

    let issueNumber: number | undefined;
    if (call.ok && call.tool === "get_issue") {
      const parsed = issueOutputSchema.safeParse(call.output);
      if (parsed.success) issueNumber = parsed.data.issue.number;
    }
    push({
      phase: "tool",
      tone: call.kind === "mcp" ? "mcp" : "local",
      title: `tool ${call.tool} (${call.kind}) ${call.ok ? "ok" : "FAIL"}${issueNumber ? ` #${issueNumber}` : ""}`,
      detail: call.ok ? call.stepId : (call.error ?? "tool failed"),
    });
  }

  push({
    phase: "hitl",
    tone: result.hitl.decision === "approve" ? "pass" : "fail",
    title: `hitl ${result.hitl.decision}`,
    detail: `${result.hitl.actor}: ${result.hitl.reason}`,
  });
  push({
    phase: "verify",
    tone: result.verdict.pass ? "pass" : "fail",
    title: `verdict ${result.verdict.label}`,
    detail: result.verdict.summary,
  });
  return events;
}
