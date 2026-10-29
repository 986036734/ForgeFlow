# ForgeFlow judge script (0:00–3:00)

Headline: `pnpm demo`. It calls the OpenAI Responses API when `OPENAI_API_KEY` is set, and the deterministic mock when it is not. This page is the offline camera script. Do not open a key file and do not play a recording from the repo.

## 90 seconds

If the clock is short, run only this:

```bash
pnpm install
pnpm demo:mock
```

On stdout, in this order: `intentional draft-pr FAIL`, then `repair 1`, then `repairs=1`, then `verdict pass`. The line above that transcript is `demo mode: mock`. Open `artifacts/last-run.html`. The sticky header is **verdict pass**. The banner is FAIL → repair 1 → PASS. Local and MCP badges are words, not color alone.

`pnpm test` and `pnpm eval` are the other two offline checks. The rest of this page is the 3-minute camera script.

## For judges

Score the offline mock for the deterministic proof. The first `draft_pr` fails on purpose. After one repair the transcript must show `repairs=1` and `verdict pass`. A repaired claim must be an exact substring of tool output. High-severity issues are `#12` and `#18`. The checklist must cover tests, docs, risk, and rollback. Do not open a key file. `pnpm demo` uses the OpenAI Responses API when `OPENAI_API_KEY` is set, and this same mock when it is not. A live run prints `demo mode: live` and a `forgeflow_audit` structured object.

## 0:00–0:20 — The sentence

Say: "ForgeFlow turns one sentence into a checkable pull request: OpenAI calls the tools, and a verifier accepts only claims copied from tool output."

Point at the opening sentence of the README. The demo goal is: audit this repo's README and open issues, then draft a PR description and checklist.

## 0:20–0:45 — Architecture

Show the mermaid diagram in the README.

Planner assigns steps. The worker runs Zod local tools and a stdio MCP issue server. The verifier checks evidence. A failed draft repairs once. HITL approves. The trace is the proof. The live path asks OpenAI to call those same tools, then return a strict JSON audit.

## 0:45–1:25 — Run the mock

```bash
pnpm install
pnpm test
pnpm demo:mock
```

On the transcript, point at:

- `demo mode: mock`
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

## 2:40–3:00 — Evals, MCP, and the live call

```bash
pnpm eval
```

Four cases: the full audit, plus three offline failures (unsupported claim, missing rollback, phantom issue `#999`).

`pnpm exec tsx src/mcp-server/index.ts` starts the stdio server with a clean stdout if a judge wants to see it idle on stdin.

If a key is available, `pnpm demo` is the live headline: function tools, then structured output named `forgeflow_audit`. Without a key it falls back to the mock you just ran. Keys and screen recordings stay out of the repo.
