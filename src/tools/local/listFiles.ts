import fs from "node:fs";
import path from "node:path";
import type { FilesOutput, ToolContext } from "../../agent/types.js";
import { listFilesInput } from "../schemas.js";

const SKIP = new Set(["node_modules", ".git", "dist", "coverage", ".pnpm-store"]);

export const listFilesTool = {
  name: "list_files",
  kind: "local" as const,
  description: "List repository files up to a small depth, skipping dependencies and VCS metadata.",
  schema: listFilesInput,
  async run(input: unknown, ctx: ToolContext): Promise<FilesOutput> {
    const parsed = listFilesInput.parse(input);
    const files: string[] = [];
    walk(ctx.repoRoot, ctx.repoRoot, parsed.depth, files);
    files.sort();
    return { files: files.slice(0, 200) };
  },
};

function walk(root: string, current: string, depth: number, files: string[]): void {
  if (depth <= 0 || files.length >= 200) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute);
    if (entry.isDirectory()) {
      walk(root, absolute, depth - 1, files);
    } else if (entry.isFile()) {
      files.push(relative);
    }
    if (files.length >= 200) return;
  }
}
