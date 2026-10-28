import fs from "node:fs";
import { z } from "zod";
import type { Issue } from "./agent/types.js";
import { issueSchema } from "./tools/schemas.js";
import { issuesPath } from "./util/paths.js";
import { ToolError } from "./util/errors.js";

const issueListSchema = z.array(issueSchema);

export function loadIssues(file = issuesPath()): Issue[] {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ToolError(`Could not read issues fixture at ${file}: ${message}`);
  }
  const parsed = issueListSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ToolError(`Issues fixture is invalid: ${parsed.error.message}`);
  }
  return parsed.data.map((issue) => ({ ...issue, labels: [...issue.labels] }));
}

export function highSeverity(issues: Issue[]): Issue[] {
  return issues
    .filter((issue) => issue.state === "open" && issue.severity === "high")
    .sort((a, b) => a.number - b.number);
}

export function issueRef(number: number): string {
  return `#${number}`;
}
