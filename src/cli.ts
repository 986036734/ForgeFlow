import { loadEnvFile } from "./env.js";
import { DEMO_GOAL } from "./demo/scenarios.js";
import { demoExitCode, runMockDemo } from "./demo/run.js";
import { logger } from "./util/logger.js";
import { renderTranscript } from "./util/report.js";
import { ConfigError } from "./util/errors.js";

export async function main(argv: string[]): Promise<number> {
  loadEnvFile();
  const [command, ...rest] = argv;
  if (command === "demo") {
    const mode = readFlag(rest, "--mode") ?? "mock";
    const writeArtifacts = !rest.includes("--no-artifacts");
    if (mode === "live") {
      try {
        const { runLive } = await import("./agent/live.js");
        const goal = readFlag(rest, "--goal") ?? DEMO_GOAL;
        logger.info(await runLive(goal));
        return 0;
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        return error instanceof ConfigError ? 2 : 1;
      }
    }
    if (mode !== "mock") {
      logger.error("mode must be mock or live");
      return 1;
    }
    const result = await runMockDemo({ writeArtifacts });
    logger.info(renderTranscript(result).trimEnd());
    return demoExitCode(result);
  }
  if (command === "eval") {
    const { runEvals } = await import("../evals/runner.js");
    const report = await runEvals();
    for (const item of report.results) {
      logger.info(`${item.pass ? "PASS" : "FAIL"} ${item.id} ${item.detail}`);
    }
    return report.ok ? 0 : 1;
  }
  if (command === "mcp") {
    const { serve } = await import("./mcp-server/index.js");
    await serve();
    return 0;
  }
  logger.error("Usage: tsx src/cli.ts demo --mode mock|live | tsx src/cli.ts eval | tsx src/cli.ts mcp");
  return 1;
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
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
