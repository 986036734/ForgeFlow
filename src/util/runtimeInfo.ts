import type { RunMode } from "../agent/types.js";

export interface RuntimeInfo {
  name: "forgeflow";
  version: string;
  node: string;
  mode: RunMode;
  offline: boolean;
  sdk: string;
}

export function runtimeInfo(mode: RunMode): RuntimeInfo {
  return {
    name: "forgeflow",
    version: "0.1.0",
    node: process.version,
    mode,
    offline: mode === "mock",
    sdk: "@openai/agents@0.21.0",
  };
}
