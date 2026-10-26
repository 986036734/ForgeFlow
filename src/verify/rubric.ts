import type { EvidenceBundle, PrDraft, RubricCheck, ToolCallRecord } from "../agent/types.js";
import { REQUIRED_GATES } from "../demo/scenarios.js";
import { highSeverity } from "../issues.js";
import { checkCoverage } from "./coverage.js";
import { citedNumbers, renderDraft } from "../tools/local/draftPr.js";

export const CHECK_IDS = [
  "title",
  "summary-quote",
  "issue-citations",
  "checklist-gates",
  "evidence-map",
  "coverage",
  "no-gap",
] as const;

export function evaluateDraft(
  draft: PrDraft,
  evidence: EvidenceBundle,
  calls: ToolCallRecord[],
): RubricCheck[] {
  return [
    checkTitle(draft),
    checkSummaryQuote(draft, evidence.readme),
    checkIssueCitations(draft, evidence),
    checkChecklist(draft),
    checkEvidenceMap(draft, calls),
    checkClaims(draft, evidence),
    checkNoGap(draft),
  ];
}

function checkTitle(draft: PrDraft): RubricCheck {
  const title = draft.title.trim();
  const pass = title.length >= 12 && /audit/i.test(title) && /readme/i.test(title);
  return {
    id: "title",
    pass,
    detail: pass
      ? "Title names the audit and the README."
      : "Title must be at least 12 characters and mention both the audit and the README.",
  };
}

function checkSummaryQuote(draft: PrDraft, readme: string): RubricCheck {
  const quotes = backtickQuotes(draft.summary);
  const grounded = quotes.filter((quote) => quote.length >= 24 && readme.includes(quote));
  const pass = grounded.length > 0;
  return {
    id: "summary-quote",
    pass,
    detail: pass
      ? "Summary quotes a README line returned by the tool."
      : "Summary needs a backtick quote of at least 24 characters copied from the README tool output.",
  };
}

function checkIssueCitations(draft: PrDraft, evidence: EvidenceBundle): RubricCheck {
  const known = new Set(evidence.issues.map((issue) => issue.number));
  const cited = citedNumbers(draft);
  const highs = highSeverity(evidence.issues).map((issue) => issue.number);
  const unknown = cited.filter((number) => !known.has(number));
  const missing = highs.filter((number) => !cited.includes(number));
  const pass = unknown.length === 0 && missing.length === 0 && highs.length > 0;
  const detail = pass
    ? `Cites every high-severity issue (${highs.map((number) => `#${number}`).join(", ")}).`
    : [
        unknown.length ? `Unknown issue numbers: ${unknown.map((number) => `#${number}`).join(", ")}.` : "",
        missing.length ? `Missing high-severity issues: ${missing.map((number) => `#${number}`).join(", ")}.` : "",
        highs.length === 0 ? "No high-severity issues were available to cite." : "",
      ]
        .filter(Boolean)
        .join(" ");
  return { id: "issue-citations", pass, detail };
}

function checkChecklist(draft: PrDraft): RubricCheck {
  const blob = draft.checklist.join("\n").toLowerCase();
  const missing = REQUIRED_GATES.filter((gate) => !blob.includes(gate));
  const pass = missing.length === 0;
  return {
    id: "checklist-gates",
    pass,
    detail: pass
      ? "Checklist covers tests, docs, risk, and rollback."
      : `Checklist is missing: ${missing.join(", ")}.`,
  };
}

function checkEvidenceMap(draft: PrDraft, calls: ToolCallRecord[]): RubricCheck {
  const byId = new Map(calls.filter((call) => call.ok).map((call) => [call.id, call]));
  const mismatches: string[] = [];
  for (const ref of draft.evidence) {
    const call = byId.get(ref.callId);
    if (!call) {
      mismatches.push(`${ref.callId} is not a successful tool call`);
      continue;
    }
    if (call.tool !== ref.tool || call.kind !== ref.kind) {
      mismatches.push(`${ref.callId} does not match ${ref.tool} (${ref.kind})`);
    }
    if (!ref.supports.trim()) mismatches.push(`${ref.callId} has empty support text`);
  }
  const kinds = new Set(draft.evidence.map((ref) => ref.kind));
  const pass = mismatches.length === 0 && kinds.has("local") && kinds.has("mcp");
  return {
    id: "evidence-map",
    pass,
    detail: pass
      ? "Evidence map cites a local call and an mcp call that exist in the trace."
      : mismatches.length
        ? mismatches.join("; ")
        : "Evidence map must include both a local tool and an mcp tool.",
  };
}

function checkClaims(draft: PrDraft, evidence: EvidenceBundle): RubricCheck {
  const report = checkCoverage(draft.claims, evidence.corpus);
  const unsupported = report.results.filter((result) => !result.supported).map((result) => result.claim);
  return {
    id: "coverage",
    pass: report.pass,
    detail: report.pass
      ? "Every claim is a substring of the tool corpus."
      : `Unsupported claims: ${unsupported.join(" | ") || "(none supplied)"}`,
  };
}

function checkNoGap(draft: PrDraft): RubricCheck {
  const rendered = renderDraft(draft);
  const pass = !draft.intentionalGap && !rendered.includes("INTENTIONAL_GAP");
  return {
    id: "no-gap",
    pass,
    detail: pass ? "Draft is not marked as an intentional gap." : "Draft still contains the intentional gap marker.",
  };
}

function backtickQuotes(text: string): string[] {
  return [...text.matchAll(/`([^`]{24,})`/g)].map((match) => match[1] ?? "");
}
