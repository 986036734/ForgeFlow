import OpenAI from "openai";

export interface LiveFunctionCall {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
}

export interface LiveMessage {
  type: "message";
  text: string;
}

export type LiveOutputItem = LiveFunctionCall | LiveMessage;

export interface LiveResponse {
  id: string;
  output: LiveOutputItem[];
}

export interface LiveTextFormat {
  type: "json_schema";
  name: string;
  strict?: boolean | null;
  schema: { [key: string]: unknown };
  description?: string;
}

export interface LiveRequest {
  model: string;
  instructions: string;
  input: unknown;
  tools?: readonly unknown[];
  tool_choice?: "auto" | "required" | "none";
  previous_response_id?: string;
  text?: { format: LiveTextFormat };
  parallel_tool_calls?: boolean;
}

/** Narrow client seam so tests can substitute a fake and stay off the network. */
export interface ResponsesClient {
  create(request: LiveRequest): Promise<LiveResponse>;
}

/** Builds the real OpenAI Responses client. The key is never logged. */
export function createResponsesClient(apiKey: string): ResponsesClient {
  const client = new OpenAI({ apiKey });
  return {
    async create(request) {
      const response = await client.responses.create({
        model: request.model,
        instructions: request.instructions,
        input: request.input as OpenAI.Responses.ResponseCreateParamsNonStreaming["input"],
        ...(request.tools
          ? {
              tools: request.tools as OpenAI.Responses.ResponseCreateParamsNonStreaming["tools"],
              tool_choice: request.tool_choice,
              parallel_tool_calls: request.parallel_tool_calls ?? true,
            }
          : {}),
        ...(request.previous_response_id ? { previous_response_id: request.previous_response_id } : {}),
        ...(request.text
          ? { text: request.text as OpenAI.Responses.ResponseCreateParamsNonStreaming["text"] }
          : {}),
      });
      return normalizeResponse(response);
    },
  };
}

function normalizeResponse(response: OpenAI.Responses.Response): LiveResponse {
  const output: LiveOutputItem[] = [];
  for (const item of response.output) {
    if (item.type === "function_call") {
      output.push({
        type: "function_call",
        name: item.name,
        arguments: item.arguments,
        call_id: item.call_id,
      });
      continue;
    }
    if (item.type === "message") {
      const text = item.content.map((part) => (part.type === "output_text" ? part.text : "")).join("");
      if (text.trim()) output.push({ type: "message", text });
    }
  }
  if (!output.some((item) => item.type === "message") && response.output_text.trim()) {
    output.push({ type: "message", text: response.output_text });
  }
  return { id: response.id, output };
}
