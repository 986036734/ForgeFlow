export class ForgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConfigError extends ForgeError {}

export class ToolError extends ForgeError {}

export class McpError extends ForgeError {}

/** First zod issue messages, without dumping the rejected payload. */
export function schemaMessage(error: { issues?: ReadonlyArray<{ message?: string }> }): string {
  const text = (error.issues ?? [])
    .map((issue) => issue.message)
    .filter((message): message is string => typeof message === "string" && message.length > 0)
    .join("; ");
  return text || "invalid payload";
}
