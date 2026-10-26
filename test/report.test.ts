import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWorkflow } from "../src/agent/loop.js";
import { DEMO_GOAL } from "../src/demo/scenarios.js";
import { renderHtml, renderMarkdown, renderTranscript } from "../src/util/report.js";

describe("trace report", () => {
  it("prints plan tags, the intentional fail, and repairs=1", async () => {
    const result = await runWorkflow({ goal: DEMO_GOAL, writeArtifacts: false });
    const text = renderTranscript(result);
    expect(text).toContain("read_readme [local]");
    expect(text).toContain("list_open_issues [mcp]");
    expect(text).toContain("tool read_readme (local) ok");
    expect(text).toContain("tool list_open_issues (mcp) ok");
    expect(text).toContain("tool get_issue (mcp) ok #12");
    expect(text).toContain("intentional draft-pr FAIL");
    expect(text).toContain("verifier FAIL");
    expect(text).toContain("repair 1");
    expect(text).toContain("tool draft_pr (local) ok");
    expect(text).toContain("verifier PASS");
    expect(text).toContain("hitl approve");
    expect(text).toContain("repairs=1");
    expect(text).toContain("verdict pass");
  });

  it("renders a standalone HTML page for the recording", async () => {
    const result = await runWorkflow({ goal: DEMO_GOAL, writeArtifacts: false });
    const html = renderHtml(result);
    expect(html).toContain('data-verdict="pass"');
    expect(html).toContain('data-repairs="1"');
    expect(html).toContain("intentional draft-pr FAIL");
    expect(html).toContain("local");
    expect(html).toContain("mcp");
    expect(html).not.toMatch(/https?:\/\//);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("writes markdown and html artifacts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "forgeflow-"));
    const result = await runWorkflow({ goal: DEMO_GOAL, writeArtifacts: true, artifactsDir: dir });
    const markdown = await fs.readFile(path.join(dir, "last-run.md"), "utf8");
    const html = await fs.readFile(path.join(dir, "last-run.html"), "utf8");
    expect(markdown).toContain("repairs=1");
    expect(markdown).toContain("verdict pass");
    expect(html).toContain("data-verdict=\"pass\"");
    expect(renderMarkdown(result)).toContain("Attempt 1 FAIL");
  });
});
