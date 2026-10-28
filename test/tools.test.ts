import { describe, expect, it } from "vitest";
import { readReadmeTool } from "../src/tools/local/readReadme.js";
import { listFilesTool } from "../src/tools/local/listFiles.js";
import { intentionalGapDraft, parsePrDraft } from "../src/tools/local/draftPr.js";
import { readReadmeInput } from "../src/tools/schemas.js";
import { repoRoot } from "../src/util/paths.js";
import type { ToolContext } from "../src/agent/types.js";

const ctx: ToolContext = {
  repoRoot: repoRoot(),
  goal: "Audit the README",
  calls: [],
  intentionalFirstDraftFail: true,
  forceFailDrafts: false,
};

describe("local tools", () => {
  it("reads the repository README", async () => {
    const output = await readReadmeTool.run({ path: "README.md" }, ctx);
    expect(output.path).toBe("README.md");
    expect(output.text).toContain("ForgeFlow");
    expect(output.bytes).toBeGreaterThan(24);
  });

  it("rejects a path that escapes the repository", async () => {
    await expect(readReadmeTool.run({ path: "../secrets.txt" }, ctx)).rejects.toThrow(/escapes/);
  });

  it("rejects an empty README path", () => {
    expect(() => readReadmeInput.parse({ path: "" })).toThrow();
  });

  it("lists files without dependency directories", async () => {
    const output = await listFilesTool.run({ depth: 2 }, ctx);
    expect(output.files).toContain("DEMO.md");
    expect(output.files).toContain("src/cli.ts");
    expect(output.files.some((file) => file.includes("node_modules"))).toBe(false);
  });

  it("marks the first draft as an intentional gap", () => {
    const draft = intentionalGapDraft(1);
    expect(draft.intentionalGap).toBe(true);
    expect(draft.checklist).toEqual(["Ship it"]);
    expect(draft.issues).toEqual([]);
    expect(draft.claims[0]).toMatch(/zero risk/);
    expect(parsePrDraft(draft).intentionalGap).toBe(true);
  });

  it("rejects a draft payload that is not a PR draft", () => {
    expect(() => parsePrDraft({ title: "Update repository" })).toThrow(/unexpected payload/);
  });
});
