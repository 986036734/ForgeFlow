import type { ToolKind } from "../agent/types.js";
import { draftPrTool } from "./local/draftPr.js";
import { listFilesTool } from "./local/listFiles.js";
import { readReadmeTool } from "./local/readReadme.js";
import { draftPrInput, getIssueInput, listFilesInput, listIssuesInput, readReadmeInput } from "./schemas.js";
import type { z } from "zod";

export interface ToolDefinition {
  name: string;
  kind: ToolKind;
  description: string;
  schema: z.ZodType;
}

const local = [readReadmeTool, listFilesTool, draftPrTool];

const mcp: ToolDefinition[] = [
  {
    name: "list_open_issues",
    kind: "mcp",
    description: "List open issues from the ForgeFlow stdio MCP server.",
    schema: listIssuesInput,
  },
  {
    name: "get_issue",
    kind: "mcp",
    description: "Fetch one issue by number from the ForgeFlow stdio MCP server.",
    schema: getIssueInput,
  },
];

const byName = new Map<string, ToolDefinition>([
  ...local.map((tool) => [tool.name, tool] as const),
  ...mcp.map((tool) => [tool.name, tool] as const),
]);

export function getTool(name: string): ToolDefinition | undefined {
  return byName.get(name);
}

export function listRegisteredTools(): ToolDefinition[] {
  return [...byName.values()];
}

export { readReadmeInput, listFilesInput, listIssuesInput, getIssueInput, draftPrInput };
