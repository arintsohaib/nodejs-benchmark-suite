import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BenchError } from "../../errors/bench-error.js";
import type { StageContext } from "../../metrics/types.js";
import { createWallCollector } from "../../metrics/wall-collector.js";
import type { ProcessRunResult, ProcessRunStatus } from "../native/types.js";
import type { DockerCli, DockerSession } from "./types.js";

const TIMING_CTX: StageContext = {
  runId: "docker-runner",
  cellId: "docker",
  stageId: "exec",
  iteration: 0,
  iterationKind: "measured",
  workspacePath: ".",
};

function classifyStatus(exitCode: number, timedOut: boolean): ProcessRunStatus {
  if (timedOut) {
    return "timeout";
  }
  if (exitCode === 0) {
    return "passed";
  }
  return "failed";
}

/**
 * Timed `docker exec` of a stage command inside an existing session.
 * Image pull / create / start are outside this timer (docs/06 §9).
 */
export async function runDockerExec(options: {
  readonly cli: DockerCli;
  readonly session: DockerSession;
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly logDir: string;
  readonly logPrefix: string;
  readonly extraEnv?: Readonly<Record<string, string>>;
}): Promise<ProcessRunResult> {
  if (options.timeoutMs <= 0) {
    throw new BenchError("VALIDATION_ERROR", "timeoutMs must be positive", {
      timeoutMs: options.timeoutMs,
    });
  }

  await mkdir(options.logDir, { recursive: true });
  const stdoutPath = join(options.logDir, `${options.logPrefix}.out.log`);
  const stderrPath = join(options.logDir, `${options.logPrefix}.err.log`);

  const envArgs: string[] = [];
  if (options.extraEnv !== undefined) {
    for (const [key, value] of Object.entries(options.extraEnv)) {
      envArgs.push("-e", `${key}=${value}`);
    }
  }

  const wall = createWallCollector();
  wall.start(TIMING_CTX);

  let timedOut = false;
  let result: { exitCode: number; stdout: string; stderr: string };
  try {
    result = await options.cli.exec(
      [
        "exec",
        ...envArgs,
        "-w",
        options.session.workdir,
        options.session.containerName,
        options.command,
        ...options.args,
      ],
      { timeoutMs: options.timeoutMs },
    );
  } catch (error) {
    if (isBenchError(error) && /timed out/.test(error.message)) {
      timedOut = true;
      result = { exitCode: 1, stdout: "", stderr: error.message };
    } else {
      throw error;
    }
  }

  const samples = await Promise.resolve(wall.stop(TIMING_CTX));
  const durationMs = samples.find((sample) => sample.name === "durationMs")?.value ?? 0;

  await writeFile(stdoutPath, result.stdout, "utf8");
  await writeFile(stderrPath, result.stderr, "utf8");

  return {
    status: classifyStatus(result.exitCode, timedOut),
    exitCode: result.exitCode,
    signal: null,
    timedOut,
    durationMs,
    stdoutPath,
    stderrPath,
    pid: undefined,
  };
}

function isBenchError(error: unknown): error is BenchError {
  return error instanceof BenchError;
}
