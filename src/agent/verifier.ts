import type { AttemptRecord, EvidenceBundle, PrDraft, ToolCallRecord, Verdict } from "./types.js";
import { evaluateDraft } from "../verify/rubric.js";

export function verifyAttempt(
  draft: PrDraft,
  evidence: EvidenceBundle,
  calls: ToolCallRecord[],
): AttemptRecord {
  const checks = evaluateDraft(draft, evidence, calls);
  return {
    attempt: draft.attempt,
    draft,
    checks,
    pass: checks.every((check) => check.pass),
  };
}

export function verdictFromAttempts(attempts: AttemptRecord[], repairs: number): Verdict {
  const latest = attempts[attempts.length - 1];
  const passed = latest?.checks.filter((check) => check.pass).length ?? 0;
  const total = latest?.checks.length ?? 0;
  const score = total === 0 ? 0 : passed / total;
  const pass = latest?.pass === true;
  const failed = latest?.checks.filter((check) => !check.pass).map((check) => check.id) ?? [];
  return {
    pass,
    label: pass ? "pass" : "fail",
    score,
    repairs,
    summary: pass
      ? `All rubric checks passed after ${repairs} repair${repairs === 1 ? "" : "s"}.`
      : `Blocked on ${failed.join(", ") || "verifier"}.`,
  };
}
