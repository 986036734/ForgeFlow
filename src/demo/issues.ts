import { loadIssues } from "../issues.js";
import type { Issue } from "../agent/types.js";

export function getDemoIssues(): Issue[] {
  return loadIssues();
}

export const DEMO_REPO = "forgeflow";
