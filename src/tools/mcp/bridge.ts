import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createRequire } from "node:module";
import path from "node:path";
import { McpError } from "../../util/errors.js";
import { issuesPath } from "../../util/paths.js";

const require = createRequire(import.meta.url);

export class McpBridge {
  private client: Client | undefined;
  private transport: StdioClientTransport | undefined;
  private stderr = "";

  constructor(private readonly repoRoot: string) {}

  async start(): Promise<void> {
    const server = path.join(this.repoRoot, "src", "mcp-server", "index.ts");
    const tsx = require.resolve("tsx/cli");
    this.transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsx, server],
      cwd: this.repoRoot,
      stderr: "pipe",
      env: childEnv(issuesPath(this.repoRoot)),
    });
    this.transport.stderr?.on("data", (chunk: Buffer | string) => {
      this.stderr += String(chunk);
      if (this.stderr.length > 8000) this.stderr = this.stderr.slice(-8000);
    });
    this.client = new Client({ name: "forgeflow-worker", version: "0.1.0" });
    try {
      await this.client.connect(this.transport);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(`MCP stdio server failed to start: ${message}${this.stderr ? `\n${this.stderr}` : ""}`);
    }
  }

  async listToolNames(): Promise<string[]> {
    const client = this.requireClient();
    const listed = await client.listTools();
    return listed.tools.map((tool) => tool.name).sort();
  }

  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.requireClient();
    const result = await client.callTool({ name, arguments: args });
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
      .map((item) => (item && typeof item === "object" && "text" in item ? String(item.text ?? "") : ""))
      .join("");
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (result.isError) {
      const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
      throw new McpError(detail || `MCP tool ${name} failed`);
    }
    return parsed;
  }

  async close(): Promise<void> {
    try {
      await this.client?.close();
    } catch {
      /* process teardown */
    }
    this.client = undefined;
    this.transport = undefined;
  }

  private requireClient(): Client {
    if (!this.client) throw new McpError("MCP bridge is not started");
    return this.client;
  }
}

function childEnv(issuesFile: string): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    FORGEFLOW_ISSUES_PATH: issuesFile,
  };
  if (process.env.HOME) env.HOME = process.env.HOME;
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;
  return env;
}
