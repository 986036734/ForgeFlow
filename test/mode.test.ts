import { describe, expect, it } from "vitest";
import { DEFAULT_OPENAI_MODEL, resolveOpenAIModel, selectDemoMode } from "../src/demo/mode.js";
import { GATE_LINES } from "../src/demo/scenarios.js";

describe("demo mode selection", () => {
  it("uses the live Responses API when a key is set and no mode is forced", () => {
    const decision = selectDemoMode({
      requested: "auto",
      apiKey: "sk-test",
      model: "gpt-test-model",
    });
    expect(decision.mode).toBe("live");
    expect(decision.fallback).toBe(false);
    expect(decision.model).toBe("gpt-test-model");
    expect(decision.banner).toBe("demo mode: live (OpenAI Responses API, model gpt-test-model)");
  });

  it("falls back to the offline mock when the key is missing or blank", () => {
    for (const apiKey of [undefined, "", "   "]) {
      const decision = selectDemoMode({ requested: "auto", apiKey });
      expect(decision.mode).toBe("mock");
      expect(decision.fallback).toBe(true);
      expect(decision.model).toBe(DEFAULT_OPENAI_MODEL);
      expect(decision.banner).toBe("demo mode: mock (offline fallback; OPENAI_API_KEY is not set)");
    }
  });

  it("keeps an explicit mock offline even when a key is present", () => {
    const decision = selectDemoMode({ requested: "mock", apiKey: "sk-test", model: "gpt-test-model" });
    expect(decision).toMatchObject({ mode: "mock", fallback: false, banner: "demo mode: mock" });
  });

  it("requires a key for an explicit live run", () => {
    expect(() => selectDemoMode({ requested: "live", apiKey: undefined })).toThrow(/OPENAI_API_KEY/);
    expect(() => selectDemoMode({ requested: "live", apiKey: "  " })).toThrow(/offline mock/);
    const live = selectDemoMode({ requested: "live", apiKey: "sk-test" });
    expect(live.mode).toBe("live");
    expect(live.banner).toContain("OpenAI Responses API");
  });

  it("trims the model and otherwise uses the default", () => {
    expect(resolveOpenAIModel(undefined)).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveOpenAIModel("  ")).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveOpenAIModel("  gpt-4.1-mini  ")).toBe("gpt-4.1-mini");
  });

  it("keeps a risk line on the checklist", () => {
    expect(GATE_LINES.risk.toLowerCase()).toContain("risk");
    expect(GATE_LINES.risk.toLowerCase()).toContain("claim");
  });
});
