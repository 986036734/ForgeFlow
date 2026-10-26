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
