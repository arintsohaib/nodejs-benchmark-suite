#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { runDoctor } from "./cli/doctor.js";
import { listProfiles } from "./cli/list-profiles.js";
import { cmdReportDiff, cmdReportRerender, parseReportArgs } from "./commands/report.js";
import { loadConfig } from "./config/load-config.js";
import { isLogLevel } from "./config/parse-helpers.js";
import type { JsBenchConfig } from "./config/types.js";
import { createAppContainer } from "./di/create-app-container.js";
import { tokens } from "./di/tokens.js";
import { executeRun } from "./engine/execute.js";
import { createRunPlan } from "./engine/plan.js";
import { BenchError, ExitCode, isBenchError, toExitCode } from "./errors/bench-error.js";
import { materialize } from "./generator/materialize.js";
import { type LogLevel, type Logger, createLogger } from "./logging/logger.js";
import { loadProfile } from "./profiles/load-profile.js";
import { resolveProfileRef } from "./profiles/resolve-profile-ref.js";
import { SUITE_VERSION } from "./version.js";

function printHelp(): void {
  const lines = [
    "jsbench — Node.js development benchmark suite",
    "",
    "Usage:",
    "  jsbench <command> [options]",
    "",
    "Commands:",
    "  version                 Print suite version",
    "  help                    Show this help",
    "  doctor                  Check host prerequisites (Node, PMs, Docker)",
    "  validate-profile <ref>  Load and validate a profile (path or id)",
    "  list-profiles           List profiles under profilesDir",
    "  run --profile <ref> [--dry-run] [--continue-on-error]",
    "                          Plan and optionally execute a native run",
    "  generate --template <id> [--size] [--seed] [--out]",
    "                          Materialize a deterministic workspace",
    "  report <runDir>         Re-render summary.md + index.html from run.json",
    "  report diff <a> <b>     Compare two runs; write diff.md + diff.json",
    "",
    "Global options:",
    "  --config <path>         Path to jsbench.config.yaml",
    "  --log-level <level>     debug|info|warn|error|silent",
    "  --help                  Show help",
    "",
    "Run options:",
    "  --profile <ref>         Profile path or id under profilesDir (e.g. native-smoke)",
    "  --dry-run               Plan only; print RunPlan JSON",
    "  --continue-on-error     Continue after stage failures (exit 6 if partial)",
    "  --output-dir <path>     Override reports directory",
    "  --workspace-root <path> Override generated workspace root",
    "",
    "Generate options:",
    "  --template <id>         Template id under templates/ (required)",
    "  --size <preset>         tiny|small|medium|large|xlarge (default: tiny)",
    "  --seed <n>              Deterministic seed (default: 1)",
    "  --out <path>            Output workspace directory (generate) or diff dir (report diff)",
    "",
    "Report options:",
    "  --out <path>            Output directory for report diff (default: diff-<left>-vs-<right>)",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function cmdValidateProfile(
  profileRef: string,
  config: JsBenchConfig,
  logger: Logger,
): Promise<void> {
  const profilePath = await resolveProfileRef(profileRef, {
    profilesDir: config.profilesDir,
  });
  const loaded = await loadProfile(profilePath);
  logger.info("Profile valid", {
    id: loaded.profile.id,
    digest: loaded.digest,
    path: loaded.path,
    stages: loaded.profile.stages.length,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        id: loaded.profile.id,
        digest: loaded.digest,
        path: loaded.path,
      },
      null,
      2,
    )}\n`,
  );
}

async function cmdRunDry(profileRef: string, config: JsBenchConfig, logger: Logger): Promise<void> {
  const profilePath = await resolveProfileRef(profileRef, {
    profilesDir: config.profilesDir,
  });
  const loaded = await loadProfile(profilePath);
  const plan = createRunPlan({
    profile: loaded.profile,
    profileDigest: loaded.digest,
  });
  logger.info("Dry-run plan ready", {
    runId: plan.runId,
    profileId: loaded.profile.id,
    cells: plan.cells.length,
    stages: plan.stages.length,
  });
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

async function cmdRunExecute(
  profileRef: string,
  config: JsBenchConfig,
  logger: Logger,
  continueOnError: boolean,
): Promise<number> {
  const profilePath = await resolveProfileRef(profileRef, {
    profilesDir: config.profilesDir,
  });
  const loaded = await loadProfile(profilePath);
  const plan = createRunPlan({
    profile: loaded.profile,
    profileDigest: loaded.digest,
  });
  const result = await executeRun({
    plan,
    profilePath: loaded.path,
    config,
    logger,
    continueOnError,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: result.exitCode === ExitCode.Success,
        runId: result.artifact.runId,
        status: result.artifact.status,
        outDir: result.outDir,
        runJson: result.runJsonPath,
        summaryMd: result.summaryMdPath,
        exitCode: result.exitCode,
      },
      null,
      2,
    )}\n`,
  );
  return result.exitCode;
}

async function cmdGenerate(
  options: {
    readonly template: string;
    readonly size: string;
    readonly seed: number;
    readonly out?: string;
  },
  config: JsBenchConfig,
  logger: Logger,
): Promise<number> {
  const { isAbsolute, join, resolve } = await import("node:path");
  const workspacePath =
    options.out !== undefined
      ? isAbsolute(options.out)
        ? options.out
        : resolve(process.cwd(), options.out)
      : join(
          isAbsolute(config.workspaceRoot)
            ? config.workspaceRoot
            : resolve(process.cwd(), config.workspaceRoot),
          "manual",
          `${options.template}-${options.size}-s${options.seed}`,
        );

  const size = options.size as "tiny" | "small" | "medium" | "large" | "xlarge";
  const ref = await materialize({
    workload: {
      template: options.template,
      size,
      seed: options.seed,
    },
    workspacePath,
  });

  logger.info("Workspace materialized", {
    template: options.template,
    size: options.size,
    seed: options.seed,
    workspacePath: ref.workspacePath,
    contentDigest: ref.contentDigest,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        workspacePath: ref.workspacePath,
        contentDigest: ref.contentDigest,
        metadata: ref.metadata,
      },
      null,
      2,
    )}\n`,
  );
  return ExitCode.Success;
}

async function main(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      help: { type: "boolean", short: "h", default: false },
      config: { type: "string" },
      "log-level": { type: "string" },
      profile: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "continue-on-error": { type: "boolean", default: false },
      "output-dir": { type: "string" },
      "workspace-root": { type: "string" },
      template: { type: "string" },
      size: { type: "string", default: "tiny" },
      seed: { type: "string", default: "1" },
      out: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });

  const command = positionals[0] ?? "help";

  if (values.help === true || command === "help") {
    printHelp();
    return ExitCode.Success;
  }

  if (command === "version") {
    process.stdout.write(`${SUITE_VERSION}\n`);
    return ExitCode.Success;
  }

  const logLevelOverride = values["log-level"];
  let cliLogLevel: LogLevel | undefined;
  if (logLevelOverride !== undefined) {
    if (!isLogLevel(logLevelOverride)) {
      throw new BenchError("INVALID_CONFIG", `Invalid --log-level: ${logLevelOverride}`, {
        value: logLevelOverride,
      });
    }
    cliLogLevel = logLevelOverride;
  }

  const cliOverrides: {
    logLevel?: LogLevel;
    outputDir?: string;
    workspaceRoot?: string;
  } = {};
  if (cliLogLevel !== undefined) {
    cliOverrides.logLevel = cliLogLevel;
  }
  if (values["output-dir"] !== undefined) {
    cliOverrides.outputDir = values["output-dir"];
  }
  if (values["workspace-root"] !== undefined) {
    cliOverrides.workspaceRoot = values["workspace-root"];
  }

  const config = await loadConfig({
    ...(values.config !== undefined ? { configPath: values.config } : {}),
    ...(Object.keys(cliOverrides).length > 0 ? { cliOverrides } : {}),
  });

  const container = createAppContainer(config);
  const logger = container.resolve<Logger>(tokens.Logger);
  container.resolve<JsBenchConfig>(tokens.Config);

  switch (command) {
    case "validate-profile": {
      const profileRef = positionals[1] ?? values.profile;
      if (profileRef === undefined) {
        throw new BenchError("INVALID_CONFIG", "validate-profile requires a path or profile id");
      }
      await cmdValidateProfile(profileRef, config, logger);
      return ExitCode.Success;
    }
    case "doctor": {
      const result = await runDoctor({ logger, strictDoctor: config.strictDoctor });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.exitCode;
    }
    case "run": {
      const profileRef = values.profile ?? positionals[1];
      if (profileRef === undefined) {
        throw new BenchError("INVALID_CONFIG", "run requires --profile <path|id>");
      }
      if (values["dry-run"] === true) {
        await cmdRunDry(profileRef, config, logger);
        return ExitCode.Success;
      }
      return await cmdRunExecute(profileRef, config, logger, values["continue-on-error"] === true);
    }
    case "generate": {
      const template = values.template ?? positionals[1];
      if (template === undefined) {
        throw new BenchError("INVALID_CONFIG", "generate requires --template <id>");
      }
      const seedRaw = values.seed ?? "1";
      const seed = Number.parseInt(seedRaw, 10);
      if (!Number.isFinite(seed)) {
        throw new BenchError("INVALID_CONFIG", `Invalid --seed: ${seedRaw}`, { seed: seedRaw });
      }
      return await cmdGenerate(
        {
          template,
          size: values.size ?? "tiny",
          seed,
          ...(values.out !== undefined ? { out: values.out } : {}),
        },
        config,
        logger,
      );
    }
    case "list-profiles": {
      const items = await listProfiles(config.profilesDir);
      process.stdout.write(`${JSON.stringify({ profiles: items }, null, 2)}\n`);
      return ExitCode.Success;
    }
    case "report": {
      const parsed = parseReportArgs(positionals);
      if (parsed.mode === "diff") {
        return await cmdReportDiff(
          parsed.leftPath as string,
          parsed.rightPath as string,
          { ...(values.out !== undefined ? { out: values.out } : {}) },
          config,
          logger,
        );
      }
      return await cmdReportRerender(parsed.runPath as string, config, logger);
    }
    default:
      throw new BenchError("INVALID_CONFIG", `Unknown command: ${command}`, { command });
  }
}

/** CLI entry used by tests and the bin wrapper. */
export async function runCli(argv: readonly string[]): Promise<number> {
  try {
    return await main(argv);
  } catch (error) {
    const logger = createLogger({ level: "error" });
    if (isBenchError(error)) {
      logger.error(error.message, { code: error.code, ...(error.details ?? {}) });
    } else if (error instanceof Error) {
      logger.error(error.message, { name: error.name });
    } else {
      logger.error("Unknown failure", { error: String(error) });
    }
    return toExitCode(error);
  }
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  void runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
