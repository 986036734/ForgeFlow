import { describe, expect, it } from "vitest";
import { mcpChildEnv } from "../src/util/childEnv.js";
import { DEFAULT_MAX_REPAIRS, loadConfig } from "../src/util/config.js";
import { assertSupportedNode } from "../src/util/runtimeInfo.js";

describe("config and runtime", () => {
  it("defaults to the offline judge settings", () => {
    withEnv({}, () => {
      expect(loadConfig()).toMatchObject({
        mode: "mock",
        hitl: "auto",
        maxRepairs: DEFAULT_MAX_REPAIRS,
      });
    });
  });

  it("reads a deny gate and a live mode", () => {
    withEnv({ FORGEFLOW_MODE: "live", FORGEFLOW_HITL: "deny", FORGEFLOW_MAX_REPAIRS: "1" }, () => {
      expect(loadConfig()).toMatchObject({ mode: "live", hitl: "deny", maxRepairs: 1 });
    });
  });

  it("rejects typos instead of silently falling back", () => {
    withEnv({ FORGEFLOW_HITL: "approve" }, () => {
      expect(() => loadConfig()).toThrow(/FORGEFLOW_HITL/);
    });
    withEnv({ FORGEFLOW_MODE: "prod" }, () => {
      expect(() => loadConfig()).toThrow(/FORGEFLOW_MODE/);
    });
    withEnv({ FORGEFLOW_MAX_REPAIRS: "9" }, () => {
      expect(() => loadConfig()).toThrow(/0 to 4/);
    });
  });

  it("requires Node 20 or newer", () => {
    expect(() => assertSupportedNode("18.20.0")).toThrow(/Node 20/);
    expect(() => assertSupportedNode("20.0.0")).not.toThrow();
    expect(() => assertSupportedNode(process.versions.node)).not.toThrow();
  });

  it("does not pass an API key to the MCP child", () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-should-not-leak";
    try {
      const env = mcpChildEnv("/tmp/forgeflow-issues.json");
      expect(env.FORGEFLOW_ISSUES_PATH).toBe("/tmp/forgeflow-issues.json");
      expect(env.OPENAI_API_KEY).toBeUndefined();
      expect(JSON.stringify(env)).not.toContain("sk-test-should-not-leak");
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});

function withEnv(values: Record<string, string | undefined>, run: () => void): void {
  const keys = ["FORGEFLOW_MODE", "FORGEFLOW_HITL", "FORGEFLOW_MAX_REPAIRS"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
