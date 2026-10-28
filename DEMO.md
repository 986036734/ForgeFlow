# ForgeFlow judge script (0:00–3:00)

Scored path: `pnpm demo:mock`. Stay offline. Do not open a key file and do not play a recording from the repo.

## 90 seconds

If the clock is short, run only this:

```bash
pnpm install
pnpm demo:mock
```

`pnpm demo` is the same mock run. On stdout, in this order: `intentional draft-pr FAIL`, then `repair 1`, then `repairs=1`, then `verdict pass`. Open `artifacts/last-run.html`. The sticky header is **verdict pass**. The banner is FAIL → repair 1 → PASS. Local and MCP badges are words, not color alone.

`pnpm test` and `pnpm eval` are the other two offline checks. The rest of this page is the 3-minute camera script.

## 给评委

离线打分只看 mock。第一次 `draft_pr` 故意失败，修一次之后必须出现 `repairs=1` 和 `verdict pass`。引用必须是工具输出里的原样子串。高严重度 issue 是 `#12` 和 `#18`。清单要覆盖 tests、docs、risk、rollback。不要打开密钥，也不要依赖 `pnpm demo:live`（中国大陆可能被 OpenAI 地理封锁）。

## 0:00–0:20 — The sentence

Say: "ForgeFlow turns one sentence into a checkable tool workflow."

Point at the README judged sentence. The demo goal is: audit this repo's README and open issues, then draft a PR description and checklist.

## 0:20–0:45 — Architecture

Show the mermaid diagram in the README.

Planner assigns steps. The worker runs Zod local tools and a stdio MCP issue server. The verifier checks evidence. A failed draft repairs once. HITL approves. The trace is the proof.

## 0:45–1:25 — Run the mock

```bash
pnpm install
pnpm test
pnpm demo:mock
```

On the transcript, point at:

- plan lines tagged `[local]` and `[mcp]`
- `tool read_readme (local) ok`
- `tool list_open_issues (mcp) ok`
- `tool get_issue (mcp) ok #12` and `#18`

Say that issue data is the offline fixture, not a GitHub call.

## 1:25–2:10 — Fail, then one repair

Stay on the same transcript.

- `tool draft_pr (local) intentional draft-pr FAIL`
- `verifier FAIL` and the finding ids (no README quote, no issue numbers, checklist is only "Ship it", unsupported claim)
- `repair 1`
- `tool draft_pr (local) ok`
- `verifier PASS`
- `hitl approve`
- `repairs=1`
- `verdict pass`

The first failure is intentional. The repair is allowed to use only strings the tools returned.

## 2:10–2:40 — Trace for the camera

Open `artifacts/last-run.html`.

The sticky header shows **verdict pass**. The banner reads FAIL → repair 1 → PASS. Local and MCP badges are labeled, not color-only. Attempt 1 lists the failed checks. Attempt 2 shows the grounded PR, including quotes and `#12` / `#18`.

## 2:40–3:00 — Evals, MCP, geography

```bash
pnpm eval
```

Four cases: the full audit, plus three offline failures (unsupported claim, missing rollback, phantom issue `#999`).

`pnpm exec tsx src/mcp-server/index.ts` starts the stdio server with a clean stdout if a judge wants to see it idle on stdin.

Close on the geo caveat: `pnpm demo:live` needs `OPENAI_API_KEY` and calls `api.openai.com`, which OpenAI blocks from mainland China and some other regions. The scored path is the mock you just ran. Keys and screen recordings stay out of the repo.
