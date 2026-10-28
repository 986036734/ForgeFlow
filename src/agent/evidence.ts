import type { EvidenceBundle, Issue, ToolCallRecord } from "./types.js";
import { filesOutputSchema, issueOutputSchema, issuesOutputSchema, readmeOutputSchema } from "../tools/schemas.js";
import { schemaMessage, ToolError } from "../util/errors.js";

export function readmeExcerpt(readme: string): string {
  for (const line of readme.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length < 24) continue;
    if (/^[#|>`]/.test(trimmed) || trimmed.startsWith("-") || trimmed.startsWith("|")) continue;
    if (trimmed.includes("`")) continue;
    return trimmed;
  }
  throw new ToolError("README has no quotable line of at least 24 characters");
}

export function collectEvidence(calls: ToolCallRecord[]): EvidenceBundle {
  let readme = "";
  let readmePath = "";
  let files: string[] = [];
  const issues: Issue[] = [];

  for (const call of calls) {
    if (!call.ok) continue;
    if (call.tool === "read_readme") {
      const parsed = readmeOutputSchema.safeParse(call.output);
      if (!parsed.success) {
        throw new ToolError(`read_readme returned an unexpected payload: ${schemaMessage(parsed.error)}`);
      }
      readme = parsed.data.text;
      readmePath = parsed.data.path;
    } else if (call.tool === "list_files") {
      const parsed = filesOutputSchema.safeParse(call.output);
      if (!parsed.success) {
        throw new ToolError(`list_files returned an unexpected payload: ${schemaMessage(parsed.error)}`);
      }
      files = [...parsed.data.files];
    } else if (call.tool === "list_open_issues") {
      const parsed = issuesOutputSchema.safeParse(call.output);
      if (!parsed.success) {
        throw new ToolError(`list_open_issues returned an unexpected payload: ${schemaMessage(parsed.error)}`);
      }
      issues.splice(0, issues.length, ...parsed.data.issues);
    } else if (call.tool === "get_issue") {
      const parsed = issueOutputSchema.safeParse(call.output);
      if (!parsed.success) {
        throw new ToolError(`get_issue returned an unexpected payload: ${schemaMessage(parsed.error)}`);
      }
      const issue: Issue = parsed.data.issue;
      if (!issues.some((item) => item.number === issue.number)) issues.push(issue);
    }
  }

  const corpus = [
    readme,
    ...files,
    ...issues.flatMap((issue) => [issue.title, issue.body, `#${issue.number}`]),
  ];
  return { readmePath, readme, files, issues, corpus };
}
