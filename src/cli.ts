import { loadEnvFile } from "./env.js";
import { DEMO_GOAL } from "./demo/scenarios.js";
import { demoExitCode, runMockDemo } from "./demo/run.js";
import type { HitlPolicy, RunMode } from "./agent/types.js";
import { loadConfig, MAX_REPAIRS_CAP, type ForgeConfig } from "./util/config.js";
import { logger } from "./util/logger.js";
import { renderTranscript } from "./util/report.js";
import { ConfigError, ForgeError } from "./util/errors.js";
import { assertSupportedNode } from "./util/runtimeInfo.js";

export interface DemoInvocation {
  mode: RunMode;
  goal: string;
  writeArtifacts: boolean;
  hitl: HitlPolicy;
  maxRepairs: number;
}

const FLAG_WITH_VALUE = new Set(["--mode", "--goal", "--hitl", "--max-repairs"]);
const BOOLEAN_FLAGS = new Set(["--no-artifacts"]);

export function parseDemoArgs(args: string[], config: ForgeConfig): DemoInvocation {
  const flags = consumeFlags(args);
  const modeValue = flags.get("--mode");
  const mode = typeof modeValue === "string" ? modeValue : config.mode;
  if (mode !== "mock" && mode !== "live") {
    throw new ConfigError("mode must be mock or live");
  }
  const goalFlag = flags.get("--goal");
  if (mode === "mock" && typeof goalFlag === "string") {
    throw new ConfigError("mock mode always uses the scored demo goal. Pass --mode live to set --goal.");
  }
  const hitlFlag = flags.get("--hitl");
  const hitl = typeof hitlFlag === "string" ? hitlFlag : config.hitl;
  if (hitl !== "auto" && hitl !== "deny") {
    throw new ConfigError("hitl must be auto or deny");
  }
  let maxRepairs = config.maxRepairs;
  const repairsFlag = flags.get("--max-repairs");
  if (typeof repairsFlag === "string") {
    const parsed = Number(repairsFlag);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_REPAIRS_CAP) {
      throw new ConfigError(`--max-repairs must be an integer from 0 to ${MAX_REPAIRS_CAP}`);
    }
    maxRepairs = parsed;
  }
  return {
    mode,
    goal: typeof goalFlag === "string" ? goalFlag : DEMO_GOAL,
    writeArtifacts: flags.get("--no-artifacts") !== true,
    hitl,
    maxRepairs,
  };
}

export async function main(argv: string[]): Promise<number> {
  try {
    return await dispatch(argv);
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error(error.message);
      return 2;
    }
    if (error instanceof ForgeError) {
      logger.error(error.message);
      return 1;
    }
    throw error;
  }
}

async function dispatch(argv: string[]): Promise<number> {
  assertSupportedNode();
  loadEnvFile();
  const [command, ...rest] = argv;
  if (command === "demo") return runDemo(rest);
  if (command === "eval") {
    if (rest.length > 0) throw new ConfigError("eval takes no arguments");
    const { runEvals } = await import("../evals/runner.js");
    const report = await runEvals();
    for (const item of report.results) {
      logger.info(`${item.pass ? "PASS" : "FAIL"} ${item.id} ${item.detail}`);
    }
    return report.ok ? 0 : 1;
  }
  if (command === "mcp") {
    if (rest.length > 0) throw new ConfigError("mcp takes no arguments");
    const { serve } = await import("./mcp-server/index.js");
    await serve();
    return 0;
  }
  logger.error(
    "Usage: tsx src/cli.ts demo [--mode mock|live] [--hitl auto|deny] [--max-repairs N] [--no-artifacts] | tsx src/cli.ts eval | tsx src/cli.ts mcp",
  );
  return 1;
}

async function runDemo(args: string[]): Promise<number> {
  const parsed = parseDemoArgs(args, loadConfig());
  if (parsed.mode === "live") {
    try {
      const { runLive } = await import("./agent/live.js");
      logger.info(await runLive(parsed.goal));
      return 0;
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      logger.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
  const result = await runMockDemo({
    writeArtifacts: parsed.writeArtifacts,
    hitl: parsed.hitl,
    maxRepairs: parsed.maxRepairs,
  });
  logger.info(renderTranscript(result).trimEnd());
  const code = demoExitCode(result);
  if (code !== 0) {
    logger.error(
      `mock demo missed the judge contract. Need offline mock, repairs=1, verdict pass, and hitl approve. Got repairs=${result.verdict.repairs}, verdict ${result.verdict.label}, hitl ${result.hitl.decision}.`,
    );
  }
  return code;
}

function consumeFlags(args: string[]): Map<string, string | true> {
  const found = new Map<string, string | true>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith("--")) {
      throw new ConfigError(`Unexpected argument ${arg}`);
    }
    if (found.has(arg)) throw new ConfigError(`Duplicate flag ${arg}`);
    if (BOOLEAN_FLAGS.has(arg)) {
      found.set(arg, true);
      continue;
    }
    if (!FLAG_WITH_VALUE.has(arg)) throw new ConfigError(`Unknown flag ${arg}`);
    const value = args[i + 1];
    if (!value || value.startsWith("-")) throw new ConfigError(`${arg} requires a value`);
    found.set(arg, value);
    i += 1;
  }
  return found;
}

const entry = process.argv[1] ?? "";
if (entry.endsWith(`${pathSep()}src${pathSep()}cli.ts`) || entry.endsWith("src/cli.ts")) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
      process.exitCode = 1;
    });
}

function pathSep(): string {
  return process.platform === "win32" ? "\\" : "/";
}
