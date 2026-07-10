import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { BenchError } from "../../errors/bench-error.js";
import type { StageContext } from "../../metrics/types.js";
import { createWallCollector } from "../../metrics/wall-collector.js";
import { scrubEnv } from "./env.js";
import type { ProcessRunResult, ProcessRunStatus, RunProcessOptions } from "./types.js";

const TIMING_CTX: StageContext = {
  runId: "process-runner",
  cellId: "native",
  stageId: "spawn",
  iteration: 0,
  iterationKind: "measured",
  workspacePath: ".",
};

function killProcessGroup(pid: number): void {
  try {
    // Negative PID targets the process group (Unix). Child was started detached.
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already exited.
    }
  }
}

function classifyStatus(exitCode: number | null, timedOut: boolean): ProcessRunStatus {
  if (timedOut) {
    return "timeout";
  }
  if (exitCode === 0) {
    return "passed";
  }
  return "failed";
}

/**
 * Supervised argv spawn with scrubbed env, log capture, and process-group kill on timeout.
 * Shell mode is explicitly disabled (`shell: false`).
 */
export async function runProcess(options: RunProcessOptions): Promise<ProcessRunResult> {
  if (options.timeoutMs <= 0) {
    throw new BenchError("VALIDATION_ERROR", "timeoutMs must be positive", {
      timeoutMs: options.timeoutMs,
    });
  }
  if (options.command === "") {
    throw new BenchError("VALIDATION_ERROR", "command must not be empty", {});
  }

  await mkdir(options.logDir, { recursive: true });
  const stdoutPath = join(options.logDir, `${options.logPrefix}.out.log`);
  const stderrPath = join(options.logDir, `${options.logPrefix}.err.log`);

  const env = scrubEnv(options.env ?? process.env, {
    includeProxies: options.includeProxies === true,
    ...(options.extraEnv !== undefined ? { extra: options.extraEnv } : {}),
  });

  const stdoutFile = await open(stdoutPath, "w");
  const stderrFile = await open(stderrPath, "w");

  const wall = createWallCollector();
  wall.start(TIMING_CTX);

  let timedOut = false;
  let timer: NodeJS.Timeout | undefined;

  try {
    const settled = await new Promise<{
      status: ProcessRunStatus;
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      timedOut: boolean;
      stdoutPath: string;
      stderrPath: string;
      pid: number | undefined;
    }>((resolve, reject) => {
      const child = spawn(options.command, [...options.args], {
        cwd: options.cwd,
        env,
        stdio: ["ignore", stdoutFile.fd, stderrFile.fd],
        detached: true,
        shell: false,
      });

      child.on("error", (error) => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        reject(
          new BenchError(
            "TOOL_NOT_FOUND",
            `Failed to spawn ${options.command}: ${error.message}`,
            { command: options.command, cwd: options.cwd },
            { cause: error },
          ),
        );
      });

      child.on("close", (code, signal) => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        resolve({
          status: classifyStatus(code, timedOut),
          exitCode: code,
          signal,
          timedOut,
          stdoutPath,
          stderrPath,
          pid: child.pid,
        });
      });

      timer = setTimeout(() => {
        timedOut = true;
        if (child.pid !== undefined) {
          killProcessGroup(child.pid);
        }
      }, options.timeoutMs);
    });

    const samples = await Promise.resolve(wall.stop(TIMING_CTX));
    const durationSample = samples.find((sample) => sample.name === "durationMs");
    const durationMs = durationSample?.value ?? 0;

    return {
      ...settled,
      durationMs,
    };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    await Promise.all([stdoutFile.close(), stderrFile.close()]);
  }
}
