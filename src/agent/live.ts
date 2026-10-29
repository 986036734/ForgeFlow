import { zodResponsesFunction, zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ToolContext, ToolKind } from "./types.js";
import { LIVE_AUDIT_INSTRUCTIONS, LIVE_TOOL_INSTRUCTIONS } from "./prompts.js";
import { createResponsesClient, type LiveFunctionCall, type LiveRequest, type LiveResponse, type ResponsesClient } from "./openaiClient.js";
import { DEMO_REPO } from "../demo/scenarios.js";
import { MISSING_KEY_MESSAGE, normalizeApiKey, resolveOpenAIModel } from "../demo/mode.js";
import { getIssueInput, listFilesInput, listIssuesInput, readReadmeInput } from "../tools/schemas.js";
import { listFilesTool } from "../tools/local/listFiles.js";
import { readReadmeTool } from "../tools/local/readReadme.js";
import { McpBridge } from "../tools/mcp/bridge.js";
import { ConfigError, ForgeError, schemaMessage } from "../util/errors.js";
import { repoRoot } from "../util/paths.js";

const MAX_LIVE_TOOL_TURNS = 6;
const TOOL_OUTPUT_LIMIT = 8000;

export const auditSchema = z.object({
  title: z.string().min(1),
  readmeQuote: z.string().min(1),
  citedIssues: z.array(z.number().int()),
  checklist: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
});

export type Audit = z.infer<typeof auditSchema>;

const generatedAuditFormat = zodTextFormat(auditSchema, "forgeflow_audit", {
  description: "Grounded README audit with issue citations and a checklist.",
});

/** OpenAI strict mode rejects keywords Zod emits, such as $schema and exclusiveMinimum. */
const STRICT_SCHEMA_DROP = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "default",
]);

export function toStrictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (STRICT_SCHEMA_DROP.has(key)) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === "object" ? toStrictSchema(item as Record<string, unknown>) : item,
      );
      continue;
    }
    if (value && typeof value === "object") {
      out[key] = toStrictSchema(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

const auditFormat = {
  type: "json_schema" as const,
  name: generatedAuditFormat.name,
  strict: true as const,
  description: generatedAuditFormat.description,
  schema: toStrictSchema(generatedAuditFormat.schema),
};

interface LiveToolSpec {
  name: string;
  description: string;
  parameters: z.ZodType;
  kind: ToolKind;
}

const toolSpecs: LiveToolSpec[] = [
  {
    name: "read_readme",
    description: `${readReadmeTool.description} Start with README.md.`,
    parameters: readReadmeInput,
    kind: "local",
  },
  {
    name: "list_files",
    description: `${listFilesTool.description} Use depth 2.`,
    parameters: listFilesInput,
    kind: "local",
  },
  {
    name: "list_open_issues",
    description: `List open issues from the ForgeFlow fixture. Pass repo ${DEMO_REPO}.`,
    parameters: listIssuesInput,
    kind: "mcp",
  },
  {
    name: "get_issue",
    description: `Fetch one issue by number. Pass repo ${DEMO_REPO} and the issue number.`,
    parameters: getIssueInput,
    kind: "mcp",
  },
];

const specsByName = new Map(toolSpecs.map((spec) => [spec.name, spec]));

/** Function tools sent on the Responses API tool-calling turn. */
export const liveResponseTools = toolSpecs.map((spec) => {
  const tool = zodResponsesFunction({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
  });
  return {
    type: tool.type,
    name: tool.name,
    description: tool.description,
    strict: true as const,
    parameters: toStrictSchema((tool.parameters ?? {}) as Record<string, unknown>),
  };
});

export interface LiveRunOptions {
  root?: string;
  client?: ResponsesClient;
  model?: string;
  maxToolTurns?: number;
}

export async function runLive(goal: string, options?: LiveRunOptions | string): Promise<string> {
  const opts: LiveRunOptions = typeof options === "string" ? { root: options } : (options ?? {});
  const root = opts.root ?? repoRoot();
  const model = resolveOpenAIModel(opts.model ?? process.env.OPENAI_MODEL);
  const apiKey = opts.client ? undefined : normalizeApiKey(process.env.OPENAI_API_KEY);
  if (!opts.client && !apiKey) throw new ConfigError(MISSING_KEY_MESSAGE);
  const client = opts.client ?? createResponsesClient(apiKey as string);
  const maxToolTurns = opts.maxToolTurns ?? MAX_LIVE_TOOL_TURNS;

  const ctx: ToolContext = {
    repoRoot: root,
    goal,
    calls: [],
    intentionalFirstDraftFail: false,
    forceFailDrafts: false,
  };
  const bridge = new McpBridge(root);
  const toolLines: string[] = [];
  const evidence: string[] = [];

  try {
    let response = await callModel(
      client,
      {
        model,
        instructions: LIVE_TOOL_INSTRUCTIONS,
        input: goal,
        tools: liveResponseTools,
        tool_choice: "required",
        parallel_tool_calls: true,
      },
      apiKey,
    );

    for (let turn = 0; turn < maxToolTurns; turn += 1) {
      const calls = functionCalls(response);
      if (calls.length === 0) break;
      const outputs = [];
      for (const call of calls) {
        const result = await executeLiveTool(call, ctx, bridge);
        toolLines.push(`tool ${call.name} (${result.kind}) ${result.ok ? "ok" : "error"}`);
        evidence.push(`${call.name}: ${result.body}`);
        outputs.push({
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: result.body,
        });
      }
      if (turn + 1 >= maxToolTurns) break;
      response = await callModel(
        client,
        {
          model,
          instructions: LIVE_TOOL_INSTRUCTIONS,
          previous_response_id: response.id,
          input: outputs,
          tools: liveResponseTools,
          tool_choice: "auto",
          parallel_tool_calls: true,
        },
        apiKey,
      );
    }

    const structured = await callModel(
      client,
      {
        model,
        instructions: LIVE_AUDIT_INSTRUCTIONS,
        previous_response_id: response.id,
        input: [
          {
            role: "user",
            content: [
              `Goal: ${goal}`,
              "Tool evidence:",
              evidence.join("\n") || "(no tool output)",
              "Fill forgeflow_audit from that evidence.",
            ].join("\n"),
          },
        ],
        text: { format: auditFormat },
      },
      apiKey,
    );
    const audit = parseAudit(messageText(structured));
    return renderLiveTranscript(model, toolLines, audit);
  } finally {
    await bridge.close();
  }
}

async function executeLiveTool(
  call: LiveFunctionCall,
  ctx: ToolContext,
  bridge: McpBridge,
): Promise<{ ok: boolean; kind: ToolKind; body: string }> {
  const spec = specsByName.get(call.name);
  if (!spec) {
    return { ok: false, kind: "local", body: JSON.stringify({ error: `Unknown tool ${call.name}` }) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(call.arguments || "{}");
  } catch {
    return { ok: false, kind: spec.kind, body: JSON.stringify({ error: "Tool arguments were not JSON" }) };
  }
  const parsed = spec.parameters.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, kind: spec.kind, body: JSON.stringify({ error: schemaMessage(parsed.error) }) };
  }
  try {
    const output = await runSpec(spec, parsed.data, ctx, bridge);
    return { ok: true, kind: spec.kind, body: clip(JSON.stringify(output)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: spec.kind, body: JSON.stringify({ error: message }) };
  }
}

async function runSpec(spec: LiveToolSpec, input: unknown, ctx: ToolContext, bridge: McpBridge): Promise<unknown> {
  if (spec.name === "read_readme") return readReadmeTool.run(input, ctx);
  if (spec.name === "list_files") return listFilesTool.run(input, ctx);
  await bridge.start();
  return bridge.call(spec.name, input as Record<string, unknown>);
}

function functionCalls(response: LiveResponse): LiveFunctionCall[] {
  return response.output.filter((item): item is LiveFunctionCall => item.type === "function_call");
}

function messageText(response: LiveResponse): string {
  return response.output
    .filter((item) => item.type === "message")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function parseAudit(text: string): Audit {
  if (!text) throw new ForgeError("OpenAI structured output was empty.");
  let value: unknown;
  try {
    value = JSON.parse(stripFence(text));
  } catch {
    throw new ForgeError("OpenAI structured output was not valid JSON.");
  }
  const parsed = auditSchema.safeParse(value);
  if (!parsed.success) {
    throw new ForgeError(`OpenAI structured output did not match forgeflow_audit: ${schemaMessage(parsed.error)}`);
  }
  return parsed.data;
}

function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced?.[1] ?? text).trim();
}

function renderLiveTranscript(model: string, toolLines: string[], audit: Audit): string {
  return [
    "api: openai responses",
    `model: ${model}`,
    ...toolLines,
    "structured output: forgeflow_audit",
    `title: ${audit.title}`,
    `readmeQuote: ${audit.readmeQuote}`,
    `citedIssues: ${audit.citedIssues.map((number) => `#${number}`).join(" ")}`,
    `checklist: ${audit.checklist.join(" | ")}`,
    `summary: ${audit.summary}`,
  ].join("\n");
}

async function callModel(client: ResponsesClient, request: LiveRequest, apiKey: string | undefined): Promise<LiveResponse> {
  try {
    return await client.create(request);
  } catch (error) {
    if (error instanceof ConfigError || error instanceof ForgeError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ForgeError(redact(message, apiKey));
  }
}

function redact(message: string, apiKey: string | undefined): string {
  if (!apiKey) return message;
  return message.split(apiKey).join("[redacted]");
}

function clip(text: string): string {
  if (text.length <= TOOL_OUTPUT_LIMIT) return text;
  return `${text.slice(0, TOOL_OUTPUT_LIMIT)}\n...[truncated]`;
}
