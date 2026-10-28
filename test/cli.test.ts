import { describe, expect, it } from "vitest";
import { main, parseDemoArgs } from "../src/cli.js";
import { DEMO_GOAL } from "../src/demo/scenarios.js";
import type { ForgeConfig } from "../src/util/config.js";

const base: ForgeConfig = {
  mode: "mock",
  maxRepairs: 2,
  hitl: "auto",
  goal: "",
  writeArtifacts: true,
};

describe("demo CLI", () => {
  it("parses the scored mock invocation", () => {
    expect(parseDemoArgs(["--mode", "mock", "--no-artifacts"], base)).toEqual({
      mode: "mock",
      goal: DEMO_GOAL,
      writeArtifacts: false,
      hitl: "auto",
      maxRepairs: 2,
    });
  });

  it("lets a hitl flag override the config", () => {
    expect(parseDemoArgs(["--mode", "mock", "--hitl", "deny"], base).hitl).toBe("deny");
  });

  it("rejects a missing flag value, a custom mock goal, and an oversized repair budget", () => {
    expect(() => parseDemoArgs(["--mode"], base)).toThrow(/requires a value/);
    expect(() => parseDemoArgs(["--mode", "mock", "--goal", "other"], base)).toThrow(/scored demo goal/);
    expect(() => parseDemoArgs(["--mode", "mock", "--max-repairs", "9"], base)).toThrow(/0 to 4/);
    expect(() => parseDemoArgs(["--surprise"], base)).toThrow(/Unknown flag/);
  });

  it("returns 2 for a bad mode without running the workflow", async () => {
    await expect(main(["demo", "--mode", "sideways"])).resolves.toBe(2);
    await expect(main(["eval", "--extra"])).resolves.toBe(2);
  });

  it("prints repairs=1 and verdict pass for the scored mock", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (message?: unknown) => {
      lines.push(String(message));
    };
    const keys = ["FORGEFLOW_MODE", "FORGEFLOW_HITL", "FORGEFLOW_MAX_REPAIRS"] as const;
    const previous = new Map(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];
    try {
      const code = await main(["demo", "--mode", "mock", "--no-artifacts"]);
      const text = lines.join("\n");
      expect(code).toBe(0);
      expect(text).toContain("intentional draft-pr FAIL");
      expect(text).toContain("repair 1");
      expect(text).toContain("repairs=1");
      expect(text).toContain("verdict pass");
      expect(text).toContain("tool get_issue (mcp) ok #12");
      expect(text).toContain("tool get_issue (mcp) ok #18");
    } finally {
      console.log = original;
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
