import type { PrDraft, ToolCallRecord, ToolContext } from "../../agent/types.js";
import { GATE_LINES, REQUIRED_GATES } from "../../demo/scenarios.js";
import { draftPrInput, issueOutputSchema, prDraftSchema } from "../schemas.js";
import { collectEvidence, readmeExcerpt } from "../../agent/evidence.js";
import { highSeverity, issueRef } from "../../issues.js";
import { schemaMessage, ToolError } from "../../util/errors.js";

export const draftPrTool = {
  name: "draft_pr",
  kind: "local" as const,
  description:
    "Draft a PR description and checklist from tool evidence. The first mock attempt is an intentional gap so the verifier can reject it.",
  schema: draftPrInput,
  async run(input: unknown, ctx: ToolContext): Promise<PrDraft> {
    const parsed = draftPrInput.parse(input);
    if (ctx.forceFailDrafts || (ctx.intentionalFirstDraftFail && parsed.attempt === 1)) {
      return intentionalGapDraft(parsed.attempt);
    }
    return groundedDraft(parsed.goal, parsed.attempt, ctx.calls);
  },
};

export function intentionalGapDraft(attempt: number): PrDraft {
  return {
    title: "Update repository",
    summary: "General cleanup of the repository with no cited sources.",
    readmeFindings: ["The README is probably fine."],
    issues: [],
    checklist: ["Ship it"],
    evidence: [],
    claims: ["All CI checks are already green and this change has zero risk."],
    attempt,
    intentionalGap: true,
  };
}

export function groundedDraft(goal: string, attempt: number, calls: ToolCallRecord[]): PrDraft {
  const evidence = collectEvidence(calls);
  const excerpt = readmeExcerpt(evidence.readme);
  const cleanGoal = goal.replace(/[. ]+$/, "");
  const highs = highSeverity(evidence.issues);
  const readmeCall = calls.find((call) => call.ok && call.tool === "read_readme");
  const issuesCall = calls.find((call) => call.ok && call.tool === "list_open_issues");
  const fileCall = calls.find((call) => call.ok && call.tool === "list_files");
  const anchor = evidence.files.find((file) => file === "DEMO.md" || file === "src/cli.ts");
  const claims = [excerpt, ...highs.map((issue) => issue.title)];
  if (anchor) claims.push(anchor);

  const evidenceRefs = [
    readmeCall
      ? { callId: readmeCall.id, tool: readmeCall.tool, kind: readmeCall.kind, supports: excerpt }
      : undefined,
    issuesCall
      ? {
          callId: issuesCall.id,
          tool: issuesCall.tool,
          kind: issuesCall.kind,
          supports: "open issue list",
        }
      : undefined,
    fileCall && anchor
      ? { callId: fileCall.id, tool: fileCall.tool, kind: fileCall.kind, supports: anchor }
      : undefined,
  ].filter((item): item is NonNullable<typeof item> => item !== undefined);

  for (const call of calls) {
    if (!call.ok || call.tool !== "get_issue") continue;
    const parsed = issueOutputSchema.safeParse(call.output);
    if (!parsed.success) continue;
    evidenceRefs.push({
      callId: call.id,
      tool: call.tool,
      kind: call.kind,
      supports: parsed.data.issue.title,
    });
  }

  return {
    title: "PR: Audit README and cite open issues",
    summary: `Audit for "${cleanGoal}". README states: \`${excerpt}\` The checklist is limited to evidence from local tools and MCP issue tools.`,
    readmeFindings: [`README states: \`${excerpt}\``],
    issues: evidence.issues
      .filter((issue) => issue.state === "open")
      .sort((a, b) => a.number - b.number)
      .map((issue) => ({
        number: issue.number,
        note: `${issue.title} — ${issue.body}`,
      })),
    checklist: REQUIRED_GATES.map((gate) => GATE_LINES[gate]),
    evidence: evidenceRefs,
    claims,
    attempt,
    intentionalGap: false,
  };
}

export function parsePrDraft(output: unknown): PrDraft {
  const parsed = prDraftSchema.safeParse(output);
  if (!parsed.success) {
    throw new ToolError(`draft_pr returned an unexpected payload: ${schemaMessage(parsed.error)}`);
  }
  return parsed.data;
}

export function citedNumbers(draft: PrDraft): number[] {
  const fromLines = draft.issues.map((issue) => issue.number);
  const rendered = renderDraft(draft);
  const fromText = [...rendered.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
  return [...new Set([...fromLines, ...fromText])].sort((a, b) => a - b);
}

export function renderDraft(draft: PrDraft): string {
  const lines = [
    `# ${draft.title}`,
    "",
    "## Summary",
    draft.summary,
    "",
    "## README findings",
    ...draft.readmeFindings.map((finding) => `- ${finding}`),
    "",
    "## Open issues",
    ...(draft.issues.length
      ? draft.issues.map((issue) => `- ${issueRef(issue.number)} ${issue.note}`)
      : ["- none cited"]),
    "",
    "## Checklist",
    ...draft.checklist.map((item) => `- [ ] ${item}`),
    "",
    "## Evidence",
    ...(draft.evidence.length
      ? draft.evidence.map((item) => `- ${item.callId} ${item.tool} (${item.kind}): ${item.supports}`)
      : ["- none"]),
    "",
    "## Claims",
    ...draft.claims.map((claim) => `- ${claim}`),
  ];
  if (draft.intentionalGap) {
    lines.push("", "INTENTIONAL_GAP");
  }
  return lines.join("\n");
}
