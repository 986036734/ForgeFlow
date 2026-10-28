import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEvalCase, runEvals } from "../evals/runner.js";
import { repoRoot } from "../src/util/paths.js";

describe("evals", () => {
  it("passes the golden workflow and the offline rubric cases", async () => {
    const report = await runEvals();
    expect(report.results.map((result) => `${result.id}:${result.pass}:${result.detail}`)).toEqual([
      "missing-rollback:true:ok",
      "phantom-issue:true:ok",
      "readme-audit:true:ok",
      "unsupported-claim:true:ok",
    ]);
    expect(report.ok).toBe(true);
  });

  it("reports a broken eval file instead of throwing", () => {
    expect(parseEvalCase("broken.json", "{").error).toMatch(/invalid JSON/);
    const mutated = parseEvalCase(
      "bad.json",
      JSON.stringify({
        id: "bad-mutate",
        kind: "rubric",
        mutate: "invented",
        expect: { pass: false, failedChecks: [] },
      }),
    );
    expect(mutated.id).toBe("bad-mutate");
    expect(mutated.spec).toBeUndefined();
    expect(mutated.error).toBeTruthy();
  });

  it("keeps the polish regressions for checklist and phantom issues", () => {
    const dir = path.join(repoRoot(), "evals", "cases");
    const ids = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")).id as string);
    expect(ids).toContain("missing-rollback");
    expect(ids).toContain("phantom-issue");
    expect(ids).toContain("unsupported-claim");
  });
});
