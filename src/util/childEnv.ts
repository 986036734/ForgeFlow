/**
 * Environment passed to the stdio MCP child.
 * The MCP client merges this with a small safe default (PATH, HOME, and similar).
 * It does not inherit the parent environment, so API keys stay out of the child.
 */
const PASSTHROUGH = ["HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "SystemRoot", "PATHEXT", "ComSpec", "USERPROFILE"] as const;

export function mcpChildEnv(issuesFile: string): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    FORGEFLOW_ISSUES_PATH: issuesFile,
  };
  for (const key of PASSTHROUGH) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}
