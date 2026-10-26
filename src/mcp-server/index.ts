import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadIssues } from "../issues.js";

export async function serve(): Promise<void> {
  const issues = loadIssues();
  const server = new McpServer({ name: "forgeflow-issues", version: "0.1.0" });

  server.registerTool(
    "list_open_issues",
    {
      description: "List open issues for a repository from the offline ForgeFlow fixture. No network.",
      inputSchema: {
        repo: z.string().describe("Repository name, for example forgeflow"),
      },
    },
    async ({ repo }) => {
      const open = issues.filter((issue) => issue.state === "open");
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ repo, issues: open }) }],
      };
    },
  );

  server.registerTool(
    "get_issue",
    {
      description: "Get one issue by number from the offline ForgeFlow fixture.",
      inputSchema: {
        repo: z.string().describe("Repository name"),
        number: z.number().int().positive().describe("Issue number"),
      },
    },
    async ({ repo, number }) => {
      const issue = issues.find((item) => item.number === number);
      if (!issue) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ repo, error: `issue #${number} not found` }),
            },
          ],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ repo, issue }) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("mcp-server/index.ts") || entry.endsWith("mcp-server/index.js")) {
  serve().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
