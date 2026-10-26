import { describe, expect, it } from "vitest";
import { McpBridge } from "../src/tools/mcp/bridge.js";
import { repoRoot } from "../src/util/paths.js";

describe("mcp stdio server", () => {
  it("lists issue tools and returns issue 12", async () => {
    const bridge = new McpBridge(repoRoot());
    await bridge.start();
    try {
      expect(await bridge.listToolNames()).toEqual(["get_issue", "list_open_issues"]);
      const listed = (await bridge.call("list_open_issues", { repo: "forgeflow" })) as {
        issues: Array<{ number: number }>;
      };
      expect(listed.issues.map((issue) => issue.number)).toEqual([12, 18, 27]);
      const one = (await bridge.call("get_issue", { repo: "forgeflow", number: 12 })) as {
        issue: { title: string };
      };
      expect(one.issue.title).toMatch(/mock judge path/);
    } finally {
      await bridge.close();
    }
  });

  it("returns an error for an unknown issue number", async () => {
    const bridge = new McpBridge(repoRoot());
    await bridge.start();
    try {
      await expect(bridge.call("get_issue", { repo: "forgeflow", number: 404 })).rejects.toThrow(/not found/);
    } finally {
      await bridge.close();
    }
  });
});
