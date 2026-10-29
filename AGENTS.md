# Agents

ForgeFlow is a TypeScript agent workflow for AgentVerse'26. The headline demo calls the OpenAI Responses API. The scored mock path stays offline.

- `pnpm demo` uses the OpenAI Responses API when `OPENAI_API_KEY` is set (model `OPENAI_MODEL`, default `gpt-5.6-luna`) and falls back to the deterministic mock when it is not. Stdout names the mode.
- Scored offline path: `pnpm test`, `pnpm demo:mock`, `pnpm eval`.
- Do not remove the intentional first-draft failure. `pnpm demo:mock` must exit 0 with `repairs=1` and `verdict pass`.
- Verifier claims must be exact substrings of tool output. Do not weaken coverage to paraphrases.
- MCP issues come from `fixtures/issues.json`. Clients should spawn `pnpm exec tsx src/mcp-server/index.ts` so stdout stays protocol-clean.
- Never commit `.env`, API keys, or screen recordings.

Node 20+, pnpm, OpenAI Responses API (`openai`), `@openai/agents` 0.21, Zod local tools, stdio MCP.
