import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { cellCacheRoot } from "../../adapters/package-managers/cache-dirs.js";
import type { JsBenchConfig } from "../../config/types.js";
import { applyStageWorkspacePolicy } from "../../engine/apply-cache-policy.js";
import { prepareWorkspace } from "../../engine/prepare-workspace.js";
import { resolveStageCommand } from "../../engine/resolve-action.js";
import type { MatrixCell, ResolvedStage, RunPlan } from "../../engine/types.js";
import { BenchError } from "../../errors/bench-error.js";
import type { Logger } from "../../logging/logger.js";
import { runWithOptionalCollectors, samplesToMetricsRecord } from "../../metrics/run-collectors.js";
import type { Collector, StageContext } from "../../metrics/types.js";
import type { StageResult } from "../../reporting/types.js";
import { assertSafeHostMountPath } from "../../security/mount-allowlist.js";
import { createDockerCli } from "./cli.js";
import { runDockerExec } from "./exec.js";
import { ensureImage, resolveImagePolicy } from "./image-policy.js";
import { createDockerSession, removeDockerSession } from "./lifecycle.js";
import { planMount } from "./mount-planner.js";
import { resolveDockerOptions } from "./resolve-options.js";
import type { DockerCli, DockerSession, ResolvedDockerImage } from "./types.js";

const DEFAULT_STAGE_TIMEOUT_MS = 60_000;

export type DockerRunContext = {
  readonly image: ResolvedDockerImage;
  readonly containerRuntime: string;
  readonly options: ReturnType<typeof resolveDockerOptions>;
};

/**
 * Ensure image once per run; returns shared docker context.
 */
export async function prepareDockerRun(options: {
  readonly plan: RunPlan;
  readonly cell: MatrixCell;
  readonly cli?: DockerCli;
  readonly logger: Logger;
}): Promise<{ readonly cli: DockerCli; readonly ctx: DockerRunContext }> {
  const cli = options.cli ?? createDockerCli();
  const dockerOpts = resolveDockerOptions(options.plan.profile, options.cell);
  const resolved = resolveImagePolicy(dockerOpts.imagePolicy);
  options.logger.info("Ensuring Docker image", {
    imagePolicy: resolved.imagePolicy,
    imageRef: resolved.imageRef,
    pull: dockerOpts.pull,
  });
  const image = await ensureImage({ cli, image: resolved, pull: dockerOpts.pull });
  const versionResult = await cli.exec(["version", "--format", "{{.Server.Version}}"], {
    timeoutMs: 15_000,
  });
  const containerRuntime = versionResult.exitCode === 0 ? versionResult.stdout.trim() : "docker";

  return {
    cli,
    ctx: {
      image,
      containerRuntime,
      options: dockerOpts,
    },
  };
}

async function runDockerStageIteration(options: {
  readonly plan: RunPlan;
  readonly cli: DockerCli;
  readonly session: DockerSession;
  readonly cell: MatrixCell;
  readonly stage: ResolvedStage;
  readonly iteration: number;
  readonly iterationKind: "warmup" | "measured";
  readonly workspacePath: string;
  readonly cacheDir: string;
  readonly logDir: string;
  readonly collectors: readonly Collector[];
}): Promise<StageResult> {
  await applyStageWorkspacePolicy(options.workspacePath, options.stage);

  const resolved = resolveStageCommand({
    stage: options.stage,
    cell: options.cell,
    cacheDir: options.cacheDir,
    executionTarget: "container",
  });
  const timeoutMs = options.stage.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  const logPrefix = `${options.stage.id}-${options.iterationKind}-${options.iteration}`;

  const ctx: StageContext = {
    runId: options.plan.runId,
    cellId: options.cell.cellId,
    stageId: options.stage.id,
    iteration: options.iteration,
    iterationKind: options.iterationKind,
    workspacePath: options.workspacePath,
    docker: { containerName: options.session.containerName },
  };

  const { result: processResult, samples } = await runWithOptionalCollectors({
    collectors: options.collectors,
    ctx,
    run: () =>
      runDockerExec({
        cli: options.cli,
        session: options.session,
        command: resolved.command,
        args: resolved.args,
        timeoutMs,
        logDir: options.logDir,
        logPrefix,
        ...(resolved.extraEnv !== undefined ? { extraEnv: resolved.extraEnv } : {}),
      }),
  });

  const status = processResult.status === "passed" ? ("passed" as const) : ("failed" as const);
  const metrics = {
    durationMs: processResult.durationMs,
    ...samplesToMetricsRecord(samples),
  };

  return {
    cellId: options.cell.cellId,
    stageId: options.stage.id,
    iteration: options.iteration,
    iterationKind: options.iterationKind,
    status,
    durationMs: processResult.durationMs,
    metrics,
    artifacts: {
      stdout: processResult.stdoutPath,
      stderr: processResult.stderrPath,
    },
  };
}

/**
 * Execute all stages for one matrix cell inside Docker.
 */
export async function executeDockerCell(options: {
  readonly plan: RunPlan;
  readonly cell: MatrixCell;
  readonly config: JsBenchConfig;
  readonly cwd: string;
  readonly workspaceRoot: string;
  readonly outDir: string;
  readonly logger: Logger;
  readonly continueOnError: boolean;
  readonly cli?: DockerCli;
  readonly sharedImage?: ResolvedDockerImage;
  readonly collectorIds?: readonly string[];
  readonly createCollectors?: (ids: readonly string[]) => Collector[];
}): Promise<{
  readonly results: StageResult[];
  readonly warnings: string[];
  readonly abortRemaining: boolean;
  readonly dockerCtx: DockerRunContext;
}> {
  const results: StageResult[] = [];
  const warnings: string[] = [];
  let abortRemaining = false;

  const dockerOpts = resolveDockerOptions(options.plan.profile, options.cell);
  const cli = options.cli ?? createDockerCli();

  let image = options.sharedImage;
  if (image === undefined) {
    const prepared = await prepareDockerRun({
      plan: options.plan,
      cell: options.cell,
      cli,
      logger: options.logger,
    });
    image = prepared.ctx.image;
  } else {
    // Still honor pull policy if shared image not yet ensured — assume caller ensured.
  }

  const versionResult = await cli.exec(["version", "--format", "{{.Server.Version}}"], {
    timeoutMs: 15_000,
  });
  const containerRuntime = versionResult.exitCode === 0 ? versionResult.stdout.trim() : "docker";

  const dockerCtx: DockerRunContext = {
    image,
    containerRuntime,
    options: dockerOpts,
  };

  const workspacePath = join(options.workspaceRoot, options.plan.runId, options.cell.cellId);
  assertSafeHostMountPath(workspacePath, { allowedRoots: [options.workspaceRoot] });
  const cacheDir = cellCacheRoot({
    workspaceRoot: options.workspaceRoot,
    runId: options.plan.runId,
    cellId: options.cell.cellId,
  });
  await mkdir(cacheDir, { recursive: true });

  const seeded = await prepareWorkspace({
    workspacePath,
    profile: options.plan.profile,
    cwd: options.cwd,
  });
  if (seeded.seededFrom !== undefined) {
    options.logger.info("Seeded workspace", {
      cellId: options.cell.cellId,
      from: seeded.seededFrom,
      mode: seeded.mode,
    });
  }

  const volumeName = `jsbench-${options.plan.runId}-${options.cell.cellId}`.replace(
    /[^a-zA-Z0-9_.-]+/g,
    "-",
  );
  const mount = planMount({
    mode: dockerOpts.mount,
    hostWorkspacePath: workspacePath,
    workdir: dockerOpts.workdir,
    volumeName,
  });

  const containerName = `jsbench-${options.plan.runId}-${options.cell.cellId}`.replace(
    /[^a-zA-Z0-9_.-]+/g,
    "-",
  );

  let session: DockerSession | undefined;
  let cellFailed = false;
  try {
    session = await createDockerSession({
      cli,
      containerName,
      image,
      mount,
      hostWorkspacePath: workspacePath,
      ...(dockerOpts.cpus !== undefined ? { cpus: dockerOpts.cpus } : {}),
      ...(dockerOpts.memory !== undefined ? { memory: dockerOpts.memory } : {}),
      ...(dockerOpts.pidsLimit !== undefined ? { pidsLimit: dockerOpts.pidsLimit } : {}),
      ...(dockerOpts.network !== undefined ? { network: dockerOpts.network } : {}),
    });

    const logDir = join(options.outDir, "logs", options.cell.cellId);
    await mkdir(logDir, { recursive: true });

    const iterationPlan: Array<{ kind: "warmup" | "measured"; index: number }> = [];
    for (let i = 1; i <= options.plan.warmup; i += 1) {
      iterationPlan.push({ kind: "warmup", index: i });
    }
    for (let i = 1; i <= options.plan.iterations; i += 1) {
      iterationPlan.push({ kind: "measured", index: i });
    }

    cellLoop: for (const iter of iterationPlan) {
      for (const stage of options.plan.stages) {
        options.logger.info("Running docker stage", {
          cellId: options.cell.cellId,
          stageId: stage.id,
          iteration: iter.index,
          iterationKind: iter.kind,
          mount: dockerOpts.mount,
        });
        const collectorIds = options.collectorIds ?? ["wall"];
        const collectors =
          options.createCollectors !== undefined ? options.createCollectors(collectorIds) : [];
        const result = await runDockerStageIteration({
          plan: options.plan,
          cli,
          session,
          cell: options.cell,
          stage,
          iteration: iter.index,
          iterationKind: iter.kind,
          workspacePath,
          cacheDir,
          logDir,
          collectors,
        });
        results.push(result);
        if (result.status === "failed") {
          cellFailed = true;
          const message = `Stage ${stage.id} failed (cell ${options.cell.cellId}, ${iter.kind} #${iter.index})`;
          warnings.push(message);
          const { readLogTail } = await import("../../cli/read-log-tail.js");
          const stdoutTail = await readLogTail(result.artifacts?.stdout);
          const stderrTail = await readLogTail(result.artifacts?.stderr);
          options.logger.warn(message, {
            durationMs: result.durationMs,
            stdout: result.artifacts?.stdout,
            stderr: result.artifacts?.stderr,
            ...(stdoutTail !== undefined ? { stdoutTail } : {}),
            ...(stderrTail !== undefined ? { stderrTail } : {}),
            hint: "Open the stdout/stderr log paths above; tails are included when non-empty.",
          });
          if (!options.continueOnError) {
            abortRemaining = true;
            break cellLoop;
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof BenchError) {
      throw error;
    }
    throw new BenchError(
      "DOCKER_ERROR",
      error instanceof Error ? error.message : String(error),
      { cellId: options.cell.cellId },
      { cause: error },
    );
  } finally {
    if (session !== undefined) {
      const shouldRemove =
        dockerOpts.removeContainers === "always" ||
        (dockerOpts.removeContainers === "on-success" && !cellFailed);
      if (shouldRemove) {
        await removeDockerSession({
          cli,
          session,
          removeVolumes: dockerOpts.removeVolumes,
        }).catch(() => undefined);
      } else {
        options.logger.warn("Retaining container for debug (removeContainers: on-success)", {
          containerName: session.containerName,
        });
      }
    }
  }

  return { results, warnings, abortRemaining, dockerCtx };
}
