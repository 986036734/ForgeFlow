import { z } from "zod";

export const readReadmeInput = z.object({
  path: z.string().min(1).max(200),
});

export const listFilesInput = z.object({
  depth: z.number().int().min(1).max(3),
});

export const listIssuesInput = z.object({
  repo: z.string().min(1).max(120),
});

export const getIssueInput = z.object({
  repo: z.string().min(1).max(120),
  number: z.number().int().positive(),
});

export const draftPrInput = z.object({
  attempt: z.number().int().min(1).max(5),
  goal: z.string().min(1),
});

export const issueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  state: z.enum(["open", "closed"]),
  labels: z.array(z.string()),
});

export const readmeOutputSchema = z.object({
  path: z.string().min(1),
  text: z.string(),
  bytes: z.number().int().nonnegative(),
});

export const filesOutputSchema = z.object({
  files: z.array(z.string()),
});

export const issuesOutputSchema = z.object({
  repo: z.string().min(1),
  issues: z.array(issueSchema),
});

export const issueOutputSchema = z.object({
  repo: z.string().min(1),
  issue: issueSchema,
});

export const prDraftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  readmeFindings: z.array(z.string()),
  issues: z.array(z.object({ number: z.number().int().positive(), note: z.string() })),
  checklist: z.array(z.string()),
  evidence: z.array(
    z.object({
      callId: z.string().min(1),
      tool: z.string().min(1),
      kind: z.enum(["local", "mcp"]),
      supports: z.string(),
    }),
  ),
  claims: z.array(z.string()),
  attempt: z.number().int().min(1).max(5),
  intentionalGap: z.boolean(),
});
