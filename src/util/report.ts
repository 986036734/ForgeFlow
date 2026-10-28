import fs from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "../agent/types.js";
import { renderDraft } from "../tools/local/draftPr.js";
import { runtimeInfo } from "./runtimeInfo.js";
import { buildTrace } from "./trace.js";

function runtimeLine(result: RunResult): string {
  const info = runtimeInfo(result.mode);
  return `${info.name} ${info.version} · node ${info.node} · ${info.sdk}`;
}

export function renderTranscript(result: RunResult): string {
  const lines = [
    "ForgeFlow mock demo",
    `mode: ${result.mode}`,
    `offline: ${String(result.offline)}`,
    `runtime: ${runtimeLine(result)}`,
    `goal: ${result.goal}`,
    "",
    "plan:",
    ...result.plan.steps.map((step, index) => `  ${index + 1}. ${step.tool} [${step.kind}] ${step.title}`),
    "",
  ];
  for (const event of buildTrace(result)) {
    if (event.phase === "plan") continue;
    if (event.title.startsWith("verdict")) {
      lines.push(`repairs=${result.verdict.repairs}`);
      lines.push(event.title);
      continue;
    }
    lines.push(event.title);
    if (event.phase === "verify" && event.tone === "fail" && event.detail) {
      lines.push(`findings: ${event.detail}`);
    }
  }
  lines.push("artifacts: artifacts/last-run.md");
  lines.push("artifacts: artifacts/last-run.html");
  return `${lines.join("\n")}\n`;
}

export function renderMarkdown(result: RunResult): string {
  const local = result.calls.filter((call) => call.kind === "local").length;
  const mcp = result.calls.filter((call) => call.kind === "mcp").length;
  const sections = [
    "# ForgeFlow trace",
    "",
    `**verdict ${result.verdict.label}** · repairs=${result.verdict.repairs} · offline ${String(result.offline)}`,
    "",
    `Runtime: ${runtimeLine(result)}.`,
    "",
    result.goal,
    "",
    "## Plan",
    ...result.plan.steps.map((step) => `- ${step.tool} \`[${step.kind}]\` ${step.title} — ${step.purpose}`),
    "",
    "## Timeline",
    ...buildTrace(result)
      .filter((event) => event.phase !== "plan")
      .map((event) => `- **${event.title}** — ${event.detail}`),
    "",
    `Tool calls: ${result.calls.length} (${local} local, ${mcp} mcp).`,
    "",
  ];
  result.attempts.forEach((attempt) => {
    sections.push(
      `## Attempt ${attempt.attempt} ${attempt.pass ? "PASS" : "FAIL"}`,
      "",
      ...attempt.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} \`${check.id}\` — ${check.detail}`),
      "",
      renderDraft(attempt.draft),
      "",
    );
  });
  sections.push(
    "## HITL",
    "",
    `${result.hitl.decision} by ${result.hitl.actor}. ${result.hitl.reason}.`,
    "",
  );
  return sections.join("\n");
}

export function renderHtml(result: RunResult): string {
  const failed = result.attempts.find((attempt) => !attempt.pass);
  const passed = [...result.attempts].reverse().find((attempt) => attempt.pass) ?? result.attempts[result.attempts.length - 1];
  const timeline = buildTrace(result)
    .filter((event) => event.phase !== "plan")
    .map(
      (event) =>
        `<li class="tone-${event.tone}"><span class="idx">${event.index}</span><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.detail)}</p></div></li>`,
    )
    .join("");
  const plan = result.plan.steps
    .map(
      (step, index) =>
        `<li><span class="badge ${step.kind}">${step.kind}</span><b>${index + 1}. ${escapeHtml(step.tool)}</b> ${escapeHtml(step.title)}</li>`,
    )
    .join("");
  const checks = (passed?.checks ?? [])
    .map(
      (check) =>
        `<tr><td>${check.pass ? "PASS" : "FAIL"}</td><td>${escapeHtml(check.id)}</td><td>${escapeHtml(check.detail)}</td></tr>`,
    )
    .join("");
  const firstFindings = failed
    ? failed.checks
        .filter((check) => !check.pass)
        .map((check) => `<li><b>${escapeHtml(check.id)}</b> ${escapeHtml(check.detail)}</li>`)
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ForgeFlow trace · verdict ${escapeHtml(result.verdict.label)} · repairs=${result.verdict.repairs}</title>
<style>
  :root { color-scheme: light; --ink:#142033; --muted:#445068; --line:#d5dbe6; --bg:#f4f6f8; --card:#fff; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 18px/1.45 ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: var(--bg); }
  header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid var(--line); padding: 16px 24px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
  h1 { font-size: 28px; margin: 0; letter-spacing: -0.03em; }
  h2 { font-size: 22px; margin: 0 0 12px; }
  main { max-width: 1080px; margin: 0 auto; padding: 24px; display: grid; gap: 16px; }
  .badge, .verdict { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .verdict { font-size: 22px; padding: 8px 16px; }
  .verdict.pass, .tone-pass strong { color: #085c3f; }
  .verdict.fail, .tone-fail strong { color: #7f1d1d; }
  .verdict.pass { background: #e5f6ef; }
  .verdict.fail { background: #fde8e8; }
  .local { background: #e5f6ef; color: #0b6e4f; }
  .mcp { background: #e7f0fa; color: #1d4e89; }
  .banner { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 20px 24px; }
  .banner p { margin: 8px 0 0; color: var(--muted); }
  .story { font-size: 40px; font-weight: 800; letter-spacing: -0.03em; }
  .fail { color: #7f1d1d; }
  .repair { color: #7a3e06; }
  .pass { color: #085c3f; }
  .runtime { color: var(--muted); font-size: 14px; margin-top: 4px; }
  .legend { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 12px 0 0; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .stat { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .stat b { display: block; font-size: 28px; }
  .stat span { color: var(--muted); font-size: 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  article, section { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; }
  article.fail { border-color: #f3b4b4; background: #fff7f7; }
  article.pass { border-color: #b7e4d2; background: #f5fbf8; }
  pre { white-space: pre-wrap; font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 0; }
  ol, ul { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 8px; }
  li { display: flex; gap: 8px; align-items: flex-start; }
  .idx { width: 28px; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; font-size: 16px; }
  td { border-top: 1px solid var(--line); padding: 8px 6px; vertical-align: top; }
  @media (max-width: 800px) { .stats, .grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
</style>
</head>
<body>
<header>
  <div>
    <h1>ForgeFlow</h1>
    <div>offline mock · local Zod tools + stdio MCP</div>
    <div class="runtime">${escapeHtml(runtimeLine(result))}</div>
  </div>
  <div class="verdict ${result.verdict.label}" data-verdict="${escapeHtml(result.verdict.label)}" data-repairs="${result.verdict.repairs}">verdict ${escapeHtml(result.verdict.label)}</div>
</header>
<main>
  <section class="banner">
    <div class="story"><span class="fail">FAIL</span> → <span class="repair">repair ${result.verdict.repairs}</span> → <span class="pass">${result.verdict.pass ? "PASS" : "FAIL"}</span></div>
    <p>${escapeHtml(result.goal)}</p>
    <p>Claims must be exact substrings of tool output. The first draft fails on purpose.</p>
    <p class="legend"><span class="badge local">local</span> Zod tool on disk <span class="badge mcp">mcp</span> stdio issue server</p>
  </section>
  <div class="stats">
    <div class="stat"><b>${result.verdict.repairs}</b><span>repairs</span></div>
    <div class="stat"><b>${result.calls.filter((call) => call.kind === "local").length}</b><span>local tool calls</span></div>
    <div class="stat"><b>${result.calls.filter((call) => call.kind === "mcp").length}</b><span>mcp tool calls</span></div>
    <div class="stat"><b>${result.attempts[result.attempts.length - 1]?.checks.filter((check) => check.pass).length ?? 0}/${result.attempts[result.attempts.length - 1]?.checks.length ?? 0}</b><span>checks on last draft</span></div>
  </div>
  <section>
    <h2>Plan</h2>
    <ol>${plan}</ol>
  </section>
  <div class="grid">
    <article class="fail">
      <h2>Attempt 1 · intentional draft-pr FAIL</h2>
      <ul>${firstFindings}</ul>
      <pre>${escapeHtml(failed ? renderDraft(failed.draft) : "")}</pre>
    </article>
    <article class="pass">
      <h2>Attempt ${passed?.attempt ?? 2} · ${passed?.pass ? "PASS" : "FAIL"}</h2>
      <pre>${escapeHtml(passed ? renderDraft(passed.draft) : "")}</pre>
    </article>
  </div>
  <section>
    <h2>Timeline</h2>
    <ol>${timeline}</ol>
  </section>
  <section>
    <h2>Rubric</h2>
    <table>${checks}</table>
  </section>
  <section>
    <h2>HITL</h2>
    <p><b>${escapeHtml(result.hitl.decision)}</b> · ${escapeHtml(result.hitl.actor)} · ${escapeHtml(result.hitl.reason)}</p>
  </section>
</main>
</body>
</html>
`;
}

export async function writeArtifacts(result: RunResult, dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "last-run.md"), renderMarkdown(result));
  await fs.writeFile(path.join(dir, "last-run.html"), renderHtml(result));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
