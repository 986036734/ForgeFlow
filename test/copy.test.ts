import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../src/util/paths.js";

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);

describe("English-only repository copy", () => {
  it("has no Han characters and no geography block notes", () => {
    const hits: string[] = [];
    const han = new RegExp("\\p{Script=Han}", "u");
    const blocked = [geoWord(), placeWord(), countryWord()];
    for (const file of listFiles(repoRoot())) {
      if (file.endsWith(`${path.sep}test${path.sep}copy.test.ts`)) continue;
      const text = fs.readFileSync(file, "utf8");
      const relative = path.relative(repoRoot(), file);
      const geography = relative !== "pnpm-lock.yaml" && blocked.some((word) => text.includes(word));
      if (han.test(text) || geography) hits.push(relative);
    }
    expect(hits).toEqual([]);
  });
});

function listFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      found.push(...listFiles(full));
      continue;
    }
    if (stat.isFile() && !fileLooksBinary(entry)) found.push(full);
  }
  return found;
}

function fileLooksBinary(name: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|mp4|mov|webm|pdf|zip)$/i.test(name);
}

function geoWord(): string {
  return "geo-" + "block";
}

function placeWord(): string {
  return "main" + "land";
}

function countryWord(): string {
  return "Chi" + "na";
}
