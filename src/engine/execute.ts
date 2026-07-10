import { mkdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { cellCacheRoot } from "../adapters/package-managers/cache-dirs.js";
import type { JsBenchConfig } from "../config/types.js";
import { BenchError, ExitCode } from "../errors/bench-error.js";
import type { Logger } from "../logging/logger.js";
import { createMetricsAggregator } from "../metrics/aggregate.js";
import { applyOutlierRule } from "../metrics/outliers.js";
import {
  runWithOptionalCollectors,
  samplesToMetricsRecord,
  unitForMetric,
} from "../metrics/run-collectors.js";
import type { AggregateInputSample } from "../metrics/stats.js";
import type { Collector, StageContext } from "../metrics/types.js";
import {
  DEFAULT_COLLECTOR_IDS,
  type PluginRegistry,
  createPluginRegistry,
} from "../plugins/registry.js";
import { METRICS_SCHEMA_VERSION, RUN_ARTIFACT_SCHEMA_VERSION } from "../reporting/constants.js";
import { collectEnvironmentFingerprint } from "../reporting/fingerprint.js";
import { deriveRunStatus } from "../reporting/status.js";
import type { EnvironmentFingerprint, RunArtifact, StageResult } from "../reporting/types.js";
import { writeRunArtifact } from "../reporting/write-run-artifact.js";
import {
  type DockerCli,
  type DockerRunContext,
  createDockerCli,
  executeDockerCell,
  prepareDockerRun,
} from "../runners/docker/index.js";
import { runProcess } from "../runners/native/process-runner.js";
import { SUITE_VERSION } from "../version.js";
import { applyStageWorkspacePolicy } from "./apply-cache-policy.js";
import { prepareWorkspace } from "./prepare-workspace.js";
import { resolveStageCommand } from "./resolve-action.js";
import type { MatrixCell, ResolvedStage, RunPlan } from "./types.js";

const DEFAULT_STAGE_TIMEOUT_MS = 60_000;

export type ExecuteRunOptions = {
  readonly plan: RunPlan;
  readonly profilePath: string;
  readonly config: JsBenchConfig;
  readonly logger: Logger;
  readonly continueOnError?: boolean;
  readonly cwd?: string;
  readonly createdAt?: string;
  /** Injected Docker CLI for tests. */
  readonly dockerCli?: DockerCli;
  /** Injected plugin registry for tests. */
  readonly pluginRegistry?: PluginRegistry;
};

export type ExecuteRunResult = {
  readonly artifact: RunArtifact;
  readonly outDir: string;
  readonly runJsonPath: string;
  readonly summaryMdPath?: string;
  readonly exitCode: ExitCode;
};

function resolveRoot(pathValue: string, cwd: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(cwd, pathValue);
}

function exitCodeForStatus(status: RunArtifact["status"], continueOnError: boolean): ExitCode {
  if (status === "completed") {
    return ExitCode.Success;
  }
  if (status === "partial" && continueOnError) {
    return ExitCode.PartialFailure;
  }
  return ExitCode.StageFailure;
}

function resolveCollectorIds(plan: RunPlan): readonly string[] {
  const ids = plan.profile.metrics?.collectors;
  if (ids === undefined || ids.length === 0) {
    return DEFAULT_COLLECTOR_IDS;
  }
  return ids.includes("wall") ? ids : ["wall", ...ids];
}

async function runNativeStageIteration(options: {
  readonly plan: RunPlan;
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
    executionTarget: "host",
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
  };

  const { result: processResult, samples } = await runWithOptionalCollectors({
    collectors: options.collectors,
    ctx,
    run: () =>
      runProcess({
        command: resolved.command,
        args: resolved.args,
        cwd: options.workspacePath,
        timeoutMs,
        logDir: options.logDir,
        logPrefix,
        includeProxies: options.stage.network === true,
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

function buildFingerprintDocker(
  ctx: DockerRunContext,
): NonNullable<EnvironmentFingerprint["docker"]> {
  return {
    imageRef: ctx.image.imageRef,
    ...(ctx.image.imageDigest !== undefined ? { imageDigest: ctx.image.imageDigest } : {}),
    containerRuntime: ctx.containerRuntime,
    mount: ctx.options.mount,
    ...(ctx.options.cpus !== undefined ? { cpus: ctx.options.cpus } : {}),
    ...(ctx.options.memory !== undefined ? { memory: ctx.options.memory } : {}),
    ...(ctx.options.pidsLimit !== undefined ? { pidsLimit: ctx.options.pidsLimit } : {}),
    toolProvisioning: "image",
  };
}

/**
 * Execute a planned native or Docker run: workspaces → stages → aggregates → reports.
 */
export async function executeRun(options: ExecuteRunOptions): Promise<ExecuteRunResult> {
  const cwd = options.cwd ?? process.cwd();
  const continueOnError = options.continueOnError === true;
  const runnerType = options.plan.profile.runner?.type ?? options.config.defaultRunner;

  const createdAt = options.createdAt ?? new Date().toISOString();
  const outputRoot = resolveRoot(options.config.outputDir, cwd);
  const workspaceRoot = resolveRoot(options.config.workspaceRoot, cwd);
  const outDir = join(outputRoot, options.plan.runId);
  const results: StageResult[] = [];
  const warnings: string[] = [];
  let abortRemaining = false;
  let dockerCtx: DockerRunContext | undefined;

  const registry =
    options.pluginRegistry ?? (await createPluginRegistry({ pluginPaths: options.config.plugins }));
  const collectorIds = resolveCollectorIds(options.plan);
  // Validate ids early; fresh instances are created per stage iteration.
  for (const id of collectorIds) {
    registry.createCollector(id);
  }

  options.logger.info("Starting benchmark run", {
    runId: options.plan.runId,
    profileId: options.plan.profile.id,
    runnerType,
    cells: options.plan.cells.length,
    stages: options.plan.stages.length,
    collectors: collectorIds,
    plugins: registry.plugins.map((p) => p.id),
  });

  if (runnerType === "docker") {
    const firstCell = options.plan.cells[0];
    if (firstCell === undefined) {
      throw new BenchError("INTERNAL", "Run plan has no cells");
    }
    const cli = options.dockerCli ?? createDockerCli();
    const prepared = await prepareDockerRun({
      plan: options.plan,
      cell: firstCell,
      cli,
      logger: options.logger,
    });
    dockerCtx = prepared.ctx;

    for (const cell of options.plan.cells) {
      if (abortRemaining) {
        break;
      }
      const cellResult = await executeDockerCell({
        plan: options.plan,
        cell,
        config: options.config,
        cwd,
        workspaceRoot,
        outDir,
        logger: options.logger,
        continueOnError,
        cli,
        sharedImage: prepared.ctx.image,
        collectorIds,
        createCollectors: (ids) => registry.createCollectors(ids),
      });
      results.push(...cellResult.results);
      warnings.push(...cellResult.warnings);
      dockerCtx = cellResult.dockerCtx;
      if (cellResult.abortRemaining) {
        abortRemaining = true;
      }
    }
  } else {
    for (const cell of options.plan.cells) {
      if (abortRemaining) {
        break;
      }
      const workspacePath = join(workspaceRoot, options.plan.runId, cell.cellId);
      const cacheDir = cellCacheRoot({
        workspaceRoot,
        runId: options.plan.runId,
        cellId: cell.cellId,
      });
      await mkdir(cacheDir, { recursive: true });

      const seeded = await prepareWorkspace({
        workspacePath,
        profile: options.plan.profile,
        cwd,
      });
      if (seeded.seededFrom !== undefined) {
        options.logger.info("Seeded workspace", {
          cellId: cell.cellId,
          from: seeded.seededFrom,
          mode: seeded.mode,
          contentDigest: seeded.contentDigest,
        });
      }
      const logDir = join(outDir, "logs", cell.cellId);
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
          if (abortRemaining) {
            break cellLoop;
          }
          options.logger.info("Running stage", {
            cellId: cell.cellId,
            stageId: stage.id,
            iteration: iter.index,
            iterationKind: iter.kind,
            action: stage.action,
            cache: stage.cache,
          });
          const result = await runNativeStageIteration({
            plan: options.plan,
            cell,
            stage,
            iteration: iter.index,
            iterationKind: iter.kind,
            workspacePath,
            cacheDir,
            logDir,
            collectors: registry.createCollectors(collectorIds),
          });
          results.push(result);
          if (result.status === "failed") {
            const message = `Stage ${stage.id} failed (cell ${cell.cellId}, ${iter.kind} #${iter.index})`;
            warnings.push(message);
            options.logger.warn(message, {
              durationMs: result.durationMs,
              stdout: result.artifacts?.stdout,
              stderr: result.artifacts?.stderr,
            });
            if (!continueOnError) {
              abortRemaining = true;
              break cellLoop;
            }
          }
        }
      }
    }
  }

  const samplesWithIteration: Array<AggregateInputSample & { iteration: number }> = [];
  for (const result of results) {
    if (result.iterationKind !== "measured" || result.status !== "passed") {
      continue;
    }
    for (const [metric, value] of Object.entries(result.metrics)) {
      samplesWithIteration.push({
        cellId: result.cellId,
        stageId: result.stageId,
        metric,
        unit: unitForMetric(metric),
        value,
        iteration: result.iteration,
      });
    }
  }

  const outlierRule = options.plan.profile.metrics?.outlierRule ?? "none";
  const filtered = applyOutlierRule(samplesWithIteration, outlierRule);
  warnings.push(...filtered.notes);
  const aggregates = createMetricsAggregator().aggregate(filtered.kept);
  const status = deriveRunStatus(results);
  const finishedAt = new Date().toISOString();

  const environment = await collectEnvironmentFingerprint({
    mode: runnerType === "docker" ? "docker" : "native",
    workspacePath: join(workspaceRoot, options.plan.runId),
    ...(dockerCtx !== undefined ? { docker: buildFingerprintDocker(dockerCtx) } : {}),
  });

  const artifact: RunArtifact = {
    suiteVersion: SUITE_VERSION,
    schemaVersion: RUN_ARTIFACT_SCHEMA_VERSION,
    metricsSchemaVersion: METRICS_SCHEMA_VERSION,
    runId: options.plan.runId,
    createdAt,
    finishedAt,
    status,
    profile: {
      id: options.plan.profile.id,
      digest: options.plan.profileDigest,
      path: options.profilePath,
    },
    environment,
    plan: {
      cellCount: options.plan.cells.length,
      stageIds: options.plan.stages.map((stage) => stage.id),
      warmup: options.plan.warmup,
      measured: options.plan.iterations,
    },
    results,
    aggregates,
    warnings,
    ...(filtered.rule === "iqr"
      ? {
          outlierFilter: {
            rule: "iqr" as const,
            dropped: filtered.dropped,
          },
        }
      : {}),
  };

  const written = await writeRunArtifact(artifact, outDir);

  for (const reporterId of registry.listReporterIds()) {
    try {
      await registry.createReporter(reporterId).render(artifact, outDir);
    } catch (error) {
      options.logger.warn(
        `Plugin reporter "${reporterId}" failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const exitCode = exitCodeForStatus(status, continueOnError);

  options.logger.info("Run finished", {
    runId: options.plan.runId,
    status,
    outDir,
    exitCode,
  });

  return {
    artifact,
    outDir: written.outDir,
    runJsonPath: written.runJsonPath,
    ...(written.summaryMdPath !== undefined ? { summaryMdPath: written.summaryMdPath } : {}),
    exitCode,
  };
}
