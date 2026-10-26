import fs from "node:fs";
import path from "node:path";
import type { ReadmeOutput, ToolContext } from "../../agent/types.js";
import { readReadmeInput } from "../schemas.js";
import { ToolError } from "../../util/errors.js";
import { resolveInside } from "../../util/paths.js";

export const readReadmeTool = {
  name: "read_readme",
  kind: "local" as const,
  description: "Read a Markdown file inside the repository root. Rejects paths that escape the root.",
  schema: readReadmeInput,
  async run(input: unknown, ctx: ToolContext): Promise<ReadmeOutput> {
    const parsed = readReadmeInput.parse(input);
    let file: string;
    try {
      file = resolveInside(ctx.repoRoot, parsed.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ToolError(message);
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new ToolError(`README path not found: ${parsed.path}`);
    }
    const text = fs.readFileSync(file, "utf8");
    return {
      path: path.relative(ctx.repoRoot, file) || parsed.path,
      text,
      bytes: Buffer.byteLength(text),
    };
  },
};
