import type { MetricAggregate } from "../metrics/types.js";

/**
 * Reporting / run artifact models and writers (S7 + S14).
 * @see docs/08_REPORTING.md
 * @see docs/17_IMPLEMENTATION_PLAN.md S7, S14
 */

export type RunStatus = "completed" | "failed" | "partial";

export type StageStatus = "passed" | "failed" | "skipped";

export interface ToolchainInfo {
  readonly path: string;
  readonly version: string;
}

export interface EnvironmentFingerprint {
  readonly mode: "native" | "docker";
  readonly os: {
    readonly platform: string;
    readonly release: string;
    readonly distro?: string;
  };
  readonly cpu: {
    readonly model: string;
    readonly coresLogical: number;
    readonly arch: string;
  };
  readonly memory: {
    readonly totalBytes: number;
  };
  readonly disk?: {
    readonly workspaceFs?: string;
    readonly workspacePath: string;
  };
  readonly toolchains: Readonly<Record<string, ToolchainInfo>>;
  readonly docker?: {
    readonly imageRef?: string;
    readonly imageDigest?: string;
    readonly containerRuntime?: string;
    readonly mount?: string;
    readonly cpus?: number;
    readonly memory?: string;
    readonly pidsLimit?: number;
    readonly toolProvisioning?: string;
  };
}

export interface StageResult {
  readonly cellId: string;
  readonly stageId: string;
  readonly iteration: number;
  readonly iterationKind: "warmup" | "measured";
  readonly status: StageStatus;
  readonly durationMs: number;
  readonly metrics: Readonly<Record<string, number>>;
  readonly artifacts?: {
    readonly stdout?: string;
    readonly stderr?: string;
  };
}

export interface RunPlanSummary {
  readonly cellCount: number;
  readonly stageIds: readonly string[];
  readonly warmup: number;
  readonly measured: number;
}

export interface RunArtifact {
  readonly suiteVersion: string;
  readonly schemaVersion: number;
  readonly metricsSchemaVersion: number;
  readonly runId: string;
  readonly createdAt: string;
  readonly finishedAt?: string;
  readonly status: RunStatus;
  readonly profile: {
    readonly id: string;
    readonly digest: string;
    readonly path: string;
  };
  readonly environment: EnvironmentFingerprint;
  readonly plan: RunPlanSummary;
  readonly results: readonly StageResult[];
  readonly aggregates: readonly MetricAggregate[];
  readonly warnings: readonly string[];
}

export interface Reporter {
  readonly id: string;
  render(artifact: RunArtifact, outDir: string): Promise<void>;
}

export interface ReportDiff {
  readonly leftRunId: string;
  readonly rightRunId: string;
  readonly rows: ReadonlyArray<{
    readonly stageId: string;
    readonly metric: string;
    readonly cellKey: string;
    readonly leftMedian?: number;
    readonly rightMedian?: number;
    readonly deltaAbsolute?: number;
    readonly deltaPercent?: number;
    /** Present when produced by `diffRunArtifacts` (S14). */
    readonly presence?: "both" | "left-only" | "right-only";
  }>;
}
