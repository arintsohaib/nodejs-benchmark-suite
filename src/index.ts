/**
 * Public library surface for the Node.js Benchmark Suite foundation.
 * Benchmark execution APIs will be added in later milestones.
 */

export { SUITE_VERSION } from "./version.js";

export {
  BenchError,
  ExitCode,
  isBenchError,
  toExitCode,
  type BenchErrorCode,
} from "./errors/bench-error.js";

export { createLogger, type Logger, type LogLevel, type LogFields } from "./logging/logger.js";

export { DEFAULT_CONFIG } from "./config/defaults.js";
export { loadConfig } from "./config/load-config.js";
export { mergeConfig } from "./config/merge.js";
export { redactEnvVars } from "./config/redact.js";
export { isLogLevel, parseBool, parseLogLevel } from "./config/parse-helpers.js";
export type {
  JsBenchConfig,
  JsBenchConfigPartial,
  LoadConfigOptions,
} from "./config/types.js";

export { loadProfile } from "./profiles/load-profile.js";
export { resolveProfileRef } from "./profiles/resolve-profile-ref.js";
export { digestValue } from "./profiles/digest.js";
export type {
  BenchmarkProfile,
  LoadedProfile,
  WorkloadSpec,
  StageSpec,
  RunnerSpec,
  MatrixSpec,
  IterationSpec,
} from "./profiles/types.js";

export type {
  Collector,
  MetricSample,
  MetricUnit,
  MetricAggregate,
  AggregateStats,
  MetricsAggregator,
  StageContext,
} from "./metrics/types.js";
export {
  createWallCollector,
  WallCollector,
  WALL_TIMING_SOURCE,
} from "./metrics/wall-collector.js";
export { createRusageCollector, RusageCollector } from "./metrics/rusage-collector.js";
export {
  createDiskUsageCollector,
  DiskUsageCollector,
} from "./metrics/disk-usage-collector.js";
export {
  runWithOptionalCollectors,
  samplesToMetricsRecord,
  unitForMetric,
} from "./metrics/run-collectors.js";
export type { JsBenchPlugin, PluginModule } from "./plugins/types.js";
export { loadPluginModule } from "./plugins/load-plugin.js";
export {
  createPluginRegistry,
  DEFAULT_COLLECTOR_IDS,
  type PluginRegistry,
  type CollectorFactory,
  type ReporterFactory,
} from "./plugins/registry.js";
export { createMetricsAggregator, DefaultMetricsAggregator } from "./metrics/aggregate.js";
export {
  computeAggregateStats,
  nearestRankPercentile,
  type AggregateInputSample,
} from "./metrics/stats.js";
export {
  applyOutlierRule,
  IQR_FENCE_MULTIPLIER,
  IQR_MIN_SAMPLES,
  type OutlierRule,
  type OutlierDrop,
  type OutlierFilterResult,
  type AggregateSampleWithIteration,
} from "./metrics/outliers.js";

export type {
  RunArtifact,
  StageResult,
  EnvironmentFingerprint,
  Reporter,
  ReportDiff,
  RunStatus,
  StageStatus,
  ToolchainInfo,
  RunPlanSummary,
} from "./reporting/types.js";
export {
  RUN_ARTIFACT_SCHEMA_VERSION,
  METRICS_SCHEMA_VERSION,
} from "./reporting/constants.js";
export { deriveRunStatus } from "./reporting/status.js";
export {
  collectEnvironmentFingerprint,
  type CollectFingerprintOptions,
} from "./reporting/fingerprint.js";
export {
  renderMarkdownSummary,
  createMarkdownReporter,
  MarkdownReporter,
} from "./reporting/markdown-reporter.js";
export {
  renderHtmlReport,
  createHtmlReporter,
  HtmlReporter,
} from "./reporting/html-reporter.js";
export {
  diffRunArtifacts,
  renderDiffMarkdown,
  writeReportDiff,
  type ReportDiffResult,
  type DiffRow,
  type WriteDiffOptions,
  type WriteDiffResult,
} from "./reporting/diff.js";
export {
  evaluateRegressionGate,
  type RegressionGateOptions,
  type RegressionGateResult,
  type RegressionViolation,
} from "./reporting/regression-gate.js";
export {
  buildReplayPlan,
  type ReplayPlan,
  type ReplayToolchainHint,
} from "./reporting/replay-plan.js";
export {
  buildLeaderboard,
  renderLeaderboardMarkdown,
  LEADERBOARD_SCHEMA_VERSION,
  LEADERBOARD_KIND,
  LEADERBOARD_DISCLAIMER,
  type LeaderboardDocument,
  type LeaderboardEntry,
  type LeaderboardMedian,
  type BuildLeaderboardOptions,
} from "./reporting/leaderboard.js";
export {
  discoverRunArtifacts,
  writeLeaderboard,
  buildLeaderboardFromReports,
} from "./reporting/write-leaderboard.js";
export { assertValidLeaderboard, isValidLeaderboard } from "./reporting/validate-leaderboard.js";
export { loadRunArtifact } from "./reporting/load-run-artifact.js";
export { truncateText, renderCitationBlock } from "./reporting/format.js";
export {
  writeRunArtifact,
  type WriteRunArtifactOptions,
  type WriteRunArtifactResult,
  type RunManifest,
} from "./reporting/write-run-artifact.js";
export { assertValidRunArtifact, isValidRunArtifact } from "./reporting/validate-run-artifact.js";

export type {
  RunPlan,
  Planner,
  BenchmarkEngine,
  MatrixCell,
  ResolvedStage,
} from "./engine/types.js";
export { createRunPlan, createPlanner } from "./engine/plan.js";
export { expandMatrixCells, encodeCellId } from "./engine/expand-matrix.js";
export { createRunId } from "./engine/run-id.js";
export { executeRun, type ExecuteRunOptions, type ExecuteRunResult } from "./engine/execute.js";
export { prepareWorkspace } from "./engine/prepare-workspace.js";
export {
  resolveStageCommand,
  RAW_COMMAND_ACTION,
  type ResolvedCommand,
  type ResolveStageCommandOptions,
} from "./engine/resolve-action.js";
export { assertNoShellAction, auditShellForbid } from "./security/shell-forbid.js";
export { assertSafeHostMountPath } from "./security/mount-allowlist.js";
export {
  measureOrchestrationOverhead,
  isOrchestrationOverheadWithinBudget,
  type OrchestrationOverheadResult,
} from "./security/orchestration-overhead.js";
export { applyStageWorkspacePolicy } from "./engine/apply-cache-policy.js";
export {
  resolvePackageManagerAction,
  createNpmAdapter,
  createPnpmAdapter,
  createYarnAdapter,
  isPackageManagerId,
  isPackageManagerAction,
  type PackageManagerId,
  type PackageManagerAction,
  type ResolvedPmCommand,
} from "./adapters/package-managers/index.js";
export {
  cellCacheRoot,
  npmCacheEnv,
  pnpmCacheEnv,
  yarnCacheEnv,
} from "./adapters/package-managers/cache-dirs.js";
export {
  createDockerCli,
  resolveImagePolicy,
  planMount,
  discoverDocker,
  type DockerCli,
  type DockerDiscovery,
  type ResolvedDockerImage,
} from "./runners/docker/index.js";
export { runDoctor, type DoctorResult } from "./cli/doctor.js";
export { listProfiles, type ProfileListItem } from "./cli/list-profiles.js";
export { runCli } from "./cli.js";

export {
  materialize,
  createGenerator,
  cleanWorkspace,
} from "./generator/materialize.js";
export { digestWorkspace, DIGEST_EXCLUDED_DIRS } from "./generator/digest.js";
export { loadTemplateManifest, defaultTemplatesDir } from "./generator/load-manifest.js";
export { expandWorkloadParams } from "./generator/expand.js";
export { DEFAULT_SIZE_PRESETS, isSizePresetName } from "./generator/size-presets.js";
export {
  GENERATOR_VERSION,
  type Generator,
  type MaterializeInput,
  type WorkspaceRef,
  type WorkspaceMetadata,
  type TemplateManifest,
  type ExpandedWorkloadParams,
  type SizePresetName,
  type SizeKnobs,
  type CleanMode,
  type VersionResolver,
} from "./generator/types.js";
export {
  createPinResolver,
  identityVersionResolver,
} from "./generator/version-resolver.js";

export {
  scrubEnv,
  NATIVE_ENV_ALLOWLIST,
  NATIVE_PROXY_ENV_ALLOWLIST,
} from "./runners/native/env.js";
export { runProcess } from "./runners/native/process-runner.js";
export { discoverNativeToolchains, resolveOnPath } from "./runners/native/discover.js";
export type {
  RunProcessOptions,
  ProcessRunResult,
  ProcessRunStatus,
  ToolchainDiscovery,
} from "./runners/native/types.js";

export { Container } from "./di/container.js";
export { tokens } from "./di/tokens.js";
export { createAppContainer } from "./di/create-app-container.js";
