import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

export function artifactsDir(root = repoRoot()): string {
  return path.join(root, "artifacts");
}

export function issuesPath(root = repoRoot()): string {
  return process.env.FORGEFLOW_ISSUES_PATH ?? path.join(root, "fixtures", "issues.json");
}

export function resolveInside(root: string, rel: string): string {
  if (rel.includes("\0")) {
    throw new Error("path contains a null byte");
  }
  const resolved = path.resolve(root, rel);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("path escapes repository root");
  }
  return resolved;
}
