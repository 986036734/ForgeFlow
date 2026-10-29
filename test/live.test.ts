import { beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";
import { runLive } from "../src/agent/live.js";
import type { ResponsesClient } from "../src/agent/openaiClient.js";

const hoisted = vi.hoisted(() => {
  const requests: Array<Record<string, unknown>> = [];
  const client = {
    async create(request: Record<string, unknown>) {
      requests.push(request);
      const step = requests.length;
      if (step === 1) {
        return {
          id: "resp_1",
          output: [
            {
              type: "function_call",
              name: "read_readme",
              arguments: JSON.stringify({ path: "README.md" }),
              call_id: "call_readme",
            },
          ],
        };
      }
      if (step === 2) {
        return { id: "resp_2", output: [{ type: "message", text: "evidence gathered" }] };
      }
      return {
        id: "resp_3",
        output: [
          {
            type: "message",
            text: JSON.stringify({
              title: "Audit the README",
              readmeQuote: "copied quote",
              citedIssues: [12, 18],
              checklist: ["tests", "docs", "risk", "rollback"],
              summary: "Structured audit from tool output.",
            }),
          },
        ],
      };
    },
  };
  return { requests, client };
});

vi.mock("../src/agent/openaiClient.js", () => ({
  createResponsesClient: () => hoisted.client,
}));

function scriptedClient(): { client: ResponsesClient; requests: Array<Record<string, unknown>> } {
  const requests: Array<Record<string, unknown>> = [];
  const client: ResponsesClient = {
    async create(request) {
      requests.push(request as unknown as Record<string, unknown>);
      const step = requests.length;
      if (step === 1) {
        return {
          id: "resp_1",
          output: [
            {
              type: "function_call",
              name: "read_readme",
              arguments: JSON.stringify({ path: "README.md" }),
              call_id: "call_readme",
            },
          ],
        };
      }
      if (step === 2) {
        return {
          id: "resp_2",
          output: [
            {
              type: "function_call",
              name: "list_open_issues",
              arguments: JSON.stringify({ repo: "forgeflow" }),
              call_id: "call_issues",
            },
          ],
        };
      }
      if (step === 3) {
        return { id: "resp_3", output: [{ type: "message", text: "enough evidence" }] };
      }
      return {
        id: "resp_4",
        output: [
          {
            type: "message",
            text: JSON.stringify({
              title: "Audit the README",
              readmeQuote: "copied quote",
              citedIssues: [12, 18],
              checklist: ["tests", "docs", "risk", "rollback"],
              summary: "Structured audit from tool output.",
            }),
          },
        ],
      };
    },
  };
  return { client, requests };
}

describe("live OpenAI path", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    hoisted.requests.length = 0;
    globalThis.fetch = (async () => {
      throw new Error("network disabled");
    }) as typeof fetch;
  });

  it("calls tools and then requests a strict JSON schema, with no network", async () => {
    const { client, requests } = scriptedClient();
    const text = await runLive("Audit the README", { client, model: "gpt-test-model" });
    expect(requests).toHaveLength(4);
    const first = requests[0] ?? {};
    const tools = first.tools as Array<{ name: string; type: string; strict: boolean }>;
    expect(tools.map((tool) => tool.name)).toEqual([
      "read_readme",
      "list_files",
      "list_open_issues",
      "get_issue",
    ]);
    expect(tools.every((tool) => tool.type === "function" && tool.strict === true)).toBe(true);
    expect(first.tool_choice).toBe("required");
    expect(first.text).toBeUndefined();
    expect(first.model).toBe("gpt-test-model");

    const followUp = requests[1] ?? {};
    const outputs = followUp.input as Array<{ type: string; call_id: string; output: string }>;
    expect(outputs[0]?.type).toBe("function_call_output");
    expect(outputs[0]?.call_id).toBe("call_readme");
    expect(outputs[0]?.output).toContain("ForgeFlow turns one sentence");
    expect(followUp.previous_response_id).toBe("resp_1");

    const issueCall = requests[2] ?? {};
    const issueOutputs = issueCall.input as Array<{ output: string }>;
    expect(issueOutputs[0]?.output).toContain("README quick start omits the mock judge path");

    const structured = requests[3] ?? {};
    expect(structured.tools).toBeUndefined();
    const format = (structured.text as { format: { type: string; name: string; strict: boolean; schema: { required?: string[] } } })
      .format;
    expect(format.type).toBe("json_schema");
    expect(format.name).toBe("forgeflow_audit");
    expect(format.strict).toBe(true);
    expect(format.schema.required).toEqual(
      expect.arrayContaining(["title", "readmeQuote", "citedIssues", "checklist", "summary"]),
    );
    expect(JSON.stringify(format.schema)).not.toContain("$schema");
    expect(JSON.stringify(format.schema)).not.toContain("exclusiveMinimum");
    expect(JSON.stringify(first.tools)).not.toContain("exclusiveMinimum");
    expect(text).toContain("api: openai responses");
    expect(text).toContain("model: gpt-test-model");
    expect(text).toContain("tool read_readme (local) ok");
    expect(text).toContain("tool list_open_issues (mcp) ok");
    expect(text).toContain("structured output: forgeflow_audit");
    expect(text).toContain("citedIssues: #12 #18");
    expect(text).toContain("summary: Structured audit from tool output.");
  });

  it("selects live from the CLI when a key is set and uses the injected client", async () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (message?: unknown) => {
      lines.push(String(message));
    };
    const previousKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.OPENAI_MODEL;
    process.env.OPENAI_API_KEY = "sk-test-should-not-leak";
    process.env.OPENAI_MODEL = "gpt-test-model";
    try {
      const code = await main(["demo", "--no-artifacts"]);
      const text = lines.join("\n");
      expect(code).toBe(0);
      expect(text).toContain("demo mode: live (OpenAI Responses API, model gpt-test-model)");
      expect(text).toContain("structured output: forgeflow_audit");
      expect(text).toContain("tool read_readme (local) ok");
      expect(text).not.toContain("sk-test-should-not-leak");
      expect(hoisted.requests[0]?.model).toBe("gpt-test-model");
      expect(hoisted.requests.at(-1)?.text).toBeTruthy();
    } finally {
      console.log = originalLog;
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.OPENAI_MODEL;
      else process.env.OPENAI_MODEL = previousModel;
    }
  });
});
