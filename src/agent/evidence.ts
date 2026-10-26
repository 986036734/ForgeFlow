import type { EvidenceBundle, ToolCallRecord } from "./types.js";
import { ToolError } from "../util/errors.js";
import type { FilesOutput, Issue, IssueOutput, IssuesOutput, ReadmeOutput } from "./types.js";

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
      const output = call.output as ReadmeOutput;
      readme = output.text ?? "";
      readmePath = output.path ?? "";
    } else if (call.tool === "list_files") {
      files = [...((call.output as FilesOutput).files ?? [])];
    } else if (call.tool === "list_open_issues") {
      const output = call.output as IssuesOutput;
      issues.splice(0, issues.length, ...(output.issues ?? []));
    } else if (call.tool === "get_issue") {
      const issue = (call.output as IssueOutput).issue;
      if (issue && !issues.some((item) => item.number === issue.number)) issues.push(issue);
    }
  }

  const corpus = [
    readme,
    ...files,
    ...issues.flatMap((issue) => [issue.title, issue.body, `#${issue.number}`]),
  ];
  return { readmePath, readme, files, issues, corpus };
}
