export class ForgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConfigError extends ForgeError {}

export class ToolError extends ForgeError {}

export class McpError extends ForgeError {}
