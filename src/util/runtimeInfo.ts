import type { RunMode } from "../agent/types.js";
import { ConfigError } from "./errors.js";

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

export function assertSupportedNode(version = process.versions.node): void {
  const major = Number(version.split(".")[0]);
  if (!Number.isInteger(major) || major < 20) {
    throw new ConfigError(`ForgeFlow needs Node 20 or newer. This process is ${version}.`);
  }
}
