# Agents

ForgeFlow is a TypeScript mock-first agent workflow for AgentVerse'26.

- Scored path: `pnpm test`, `pnpm demo:mock`, `pnpm eval`. All three are offline.
- Do not remove the intentional first-draft failure. `pnpm demo:mock` must exit 0 with `repairs=1` and `verdict pass`.
- Verifier claims must be exact substrings of tool output. Do not weaken coverage to paraphrases.
- MCP issues come from `fixtures/issues.json`. Clients should spawn `pnpm exec tsx src/mcp-server/index.ts` so stdout stays protocol-clean.
- Never commit `.env`, API keys, or screen recordings.
- Live OpenAI is optional and may fail on geo-blocked networks, including mainland China. Point judges at `pnpm demo:mock`.

Node 20+, pnpm, `@openai/agents` 0.21, Zod local tools, stdio MCP.
