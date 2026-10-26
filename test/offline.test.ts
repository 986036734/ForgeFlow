import { describe, expect, it } from "vitest";
import { runWorkflow } from "../src/agent/loop.js";
import { DEMO_GOAL } from "../src/demo/scenarios.js";
import { renderTranscript } from "../src/util/report.js";
import { runtimeInfo } from "../src/util/runtimeInfo.js";

describe("offline mock", () => {
  it("does not call the network or echo an API key", async () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-should-not-leak";
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: unknown) => {
      calls.push(String(input));
      throw new Error("network disabled");
    }) as typeof fetch;
    try {
      const result = await runWorkflow({ goal: DEMO_GOAL, writeArtifacts: false });
      const text = renderTranscript(result);
      expect(result.offline).toBe(true);
      expect(result.verdict.pass).toBe(true);
      expect(text).not.toContain("sk-test-should-not-leak");
      expect(calls).toEqual([]);
      expect(runtimeInfo("mock").offline).toBe(true);
    } finally {
      globalThis.fetch = original;
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });

  it("refuses live mode without a key and points at the mock path", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const { runLive } = await import("../src/agent/live.js");
      await expect(runLive(DEMO_GOAL)).rejects.toThrow(/pnpm demo:mock/);
      await expect(runLive(DEMO_GOAL)).rejects.toThrow(/China/);
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});
