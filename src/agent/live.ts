import { createRequire } from "node:module";
import path from "node:path";
import { Agent, MCPServerStdio, run, tool } from "@openai/agents";
import { z } from "zod";
import { LIVE_INSTRUCTIONS } from "./prompts.js";
import type { ToolCallRecord, ToolContext } from "./types.js";
import { mcpChildEnv } from "../util/childEnv.js";
import { ConfigError } from "../util/errors.js";
import { issuesPath, repoRoot } from "../util/paths.js";
import { draftPrTool } from "../tools/local/draftPr.js";
import { listFilesTool } from "../tools/local/listFiles.js";
import { readReadmeTool } from "../tools/local/readReadme.js";

const require = createRequire(import.meta.url);

const GEO_HINT =
  "Live OpenAI calls can fail on geo-blocked networks, including mainland China. The scored path is pnpm demo:mock.";

export async function runLive(goal: string, root = repoRoot()): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new ConfigError(`OPENAI_API_KEY is not set. Live mode calls api.openai.com, which OpenAI geo-blocks from some networks. ${GEO_HINT}`);
  }

  const calls: ToolCallRecord[] = [];
  const ctx: ToolContext = {
    repoRoot: root,
    goal,
    calls,
    intentionalFirstDraftFail: false,
    forceFailDrafts: false,
  };
  const mcp = new MCPServerStdio({
    name: "forgeflow-issues",
    command: process.execPath,
    args: [require.resolve("tsx/cli"), path.join(root, "src", "mcp-server", "index.ts")],
    cwd: root,
    env: mcpChildEnv(issuesPath(root)),
    cacheToolsList: true,
  });
  await mcp.connect();
  try {
    const readme = tool({
      name: "read_readme",
      description: readReadmeTool.description,
      parameters: z.object({ path: z.string() }),
      execute: async ({ path: readmePath }) => {
        const output = await readReadmeTool.run({ path: readmePath }, ctx);
        remember(ctx, "read_readme", { path: readmePath }, output);
        return JSON.stringify(output);
      },
    });
    const files = tool({
      name: "list_files",
      description: listFilesTool.description,
      parameters: z.object({ depth: z.number().int().min(1).max(3) }),
      execute: async ({ depth }) => {
        const output = await listFilesTool.run({ depth }, ctx);
        remember(ctx, "list_files", { depth }, output);
        return JSON.stringify(output);
      },
    });
    const draft = tool({
      name: "draft_pr",
      description: "Format a PR draft from evidence already collected in this run.",
      parameters: z.object({
        attempt: z.number().int().min(1).max(5),
        goal: z.string(),
      }),
      execute: async (input) => {
        try {
          return JSON.stringify(await draftPrTool.run(input, ctx));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return JSON.stringify({ error: message });
        }
      },
    });
    const agent = new Agent({
      name: "ForgeFlow",
      instructions: LIVE_INSTRUCTIONS,
      tools: [readme, files, draft],
      mcpServers: [mcp],
    });
    const result = await run(agent, goal, { maxTurns: 12 });
    return typeof result.finalOutput === "string" ? result.finalOutput : JSON.stringify(result.finalOutput);
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/country|region|unsupported_country|geo-block|request_forbidden/i.test(message)) {
      throw new ConfigError(`${message}\n${GEO_HINT}`);
    }
    throw error;
  } finally {
    await mcp.close();
  }
}

function remember(ctx: ToolContext, name: "read_readme" | "list_files", input: unknown, output: unknown): void {
  ctx.calls.push({
    id: `live-${ctx.calls.length + 1}`,
    stepId: "live",
    tool: name,
    kind: "local",
    input,
    output,
    ok: true,
  });
}
