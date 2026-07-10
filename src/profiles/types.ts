/** Workload declaration inside a benchmark profile. */
export interface WorkloadSpec {
  readonly template: string;
  readonly size?: "tiny" | "small" | "medium" | "large" | "xlarge";
  readonly seed?: number;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface StageSpec {
  readonly id: string;
  readonly action: string;
  readonly cache?: "cold" | "warm";
  readonly timeoutMs?: number;
  readonly network?: boolean;
  /** Executable for `raw.command` stages (S8+). */
  readonly command?: string;
  /** Argv for `raw.command` stages (S8+). */
  readonly args?: readonly string[];
  readonly reset?: "clean-install" | "keep-node-modules" | "purge-all";
}

export interface DockerRunnerOptions {
  readonly imagePolicy?: string;
  readonly pull?: "always" | "if-missing" | "never";
  readonly mount?: "bind" | "named-volume" | "copy-in" | "tmpfs";
  readonly workdir?: string;
  readonly cpus?: number;
  readonly memory?: string;
  readonly pidsLimit?: number;
  readonly network?: string;
  /** Default: always */
  readonly removeContainers?: "always" | "on-success";
  /** Default: true for named volumes created by the suite */
  readonly removeVolumes?: boolean;
}

export interface RunnerSpec {
  readonly type?: "native" | "docker";
  readonly native?: Readonly<Record<string, unknown>>;
  readonly docker?: DockerRunnerOptions;
}

export interface MetricsSpec {
  readonly collectors?: readonly string[];
}

export interface ReportingSpec {
  readonly formats?: ReadonlyArray<"json" | "markdown" | "html">;
}

export interface IterationSpec {
  readonly warmup?: number;
  readonly measured: number;
}

export type MatrixValue = string | number | boolean;

export interface MatrixSpec {
  readonly [axis: string]: readonly MatrixValue[];
}

/**
 * Declarative benchmark profile (schemaVersion 1).
 * @see schemas/profile.schema.json
 */
export interface BenchmarkProfile {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly description?: string;
  readonly workload: WorkloadSpec;
  readonly matrix?: MatrixSpec;
  readonly stages: readonly StageSpec[];
  readonly runner?: RunnerSpec;
  readonly metrics?: MetricsSpec;
  readonly reporting?: ReportingSpec;
  readonly iterations: IterationSpec;
}

export interface LoadedProfile {
  readonly profile: BenchmarkProfile;
  /** Absolute path to the source document. */
  readonly path: string;
  /** Canonical content digest of the normalized profile document. */
  readonly digest: string;
}

export interface LoadProfileOptions {
  readonly cwd?: string;
}
