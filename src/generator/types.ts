import type { WorkloadSpec } from "../profiles/types.js";

export type SizePresetName = "tiny" | "small" | "medium" | "large" | "xlarge";

export type SizeKnobs = {
  readonly fileCount: number;
  readonly packageCount: number;
  readonly tsComplexity: number;
  readonly dependencySet?: string;
};

export type TemplateManifest = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly engines?: Readonly<Record<string, string>>;
  readonly supports: {
    readonly packageManagers?: readonly string[];
    readonly sizes: readonly SizePresetName[];
  };
  readonly produces: {
    readonly kind: "library" | "application" | "workspace";
    readonly scripts?: Readonly<Record<string, string>>;
  };
  readonly sizes?: Readonly<Partial<Record<SizePresetName, SizeKnobs>>>;
  readonly parameters?: ReadonlyArray<{
    readonly name: string;
    readonly type: "integer" | "boolean" | "string";
  }>;
};

export type LoadedTemplate = {
  readonly manifest: TemplateManifest;
  /** Absolute path to the template root (contains template.manifest.yaml). */
  readonly rootDir: string;
};

export type ExpandedWorkloadParams = SizeKnobs & {
  readonly size: SizePresetName;
  readonly seed: number;
  readonly extras: Readonly<Record<string, unknown>>;
};

export type WorkspaceMetadata = {
  readonly generatorVersion: number;
  readonly suiteVersion: string;
  readonly templateId: string;
  readonly size: SizePresetName;
  readonly seed: number;
  readonly params: ExpandedWorkloadParams;
  readonly contentDigest: string;
  readonly createdAt: string;
};

export type WorkspaceRef = {
  readonly workspacePath: string;
  readonly contentDigest: string;
  readonly metadata: WorkspaceMetadata;
};

export type VersionResolver = {
  /** Resolve a dependency version spec; `packageName` is required for `policy:*`. */
  resolve(spec: string, packageName?: string): string | Promise<string>;
};

export type MaterializeInput = {
  readonly workload: WorkloadSpec;
  readonly workspacePath: string;
  readonly templatesDir?: string;
  readonly cwd?: string;
  readonly versionResolver?: VersionResolver;
  readonly createdAt?: string;
};

export type CleanMode = "retain" | "purge-on-success" | "purge-always";

export type Generator = {
  materialize(input: MaterializeInput): Promise<WorkspaceRef>;
  digest(workspacePath: string): Promise<string>;
  clean(workspacePath: string, mode: CleanMode): Promise<void>;
};

/** Locked generator metadata schema integer. */
export const GENERATOR_VERSION = 1 as const;
