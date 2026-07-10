import type { LogLevel } from "../logging/logger.js";

/** Global suite configuration after merge (see docs/03_ARCHITECTURE.md §7). */
export interface JsBenchConfig {
  readonly outputDir: string;
  readonly workspaceRoot: string;
  readonly defaultRunner: "native" | "docker";
  readonly strictDoctor: boolean;
  readonly profilesDir: string;
  readonly logLevel: LogLevel;
  readonly redactEnv: readonly string[];
  readonly toolchains: {
    readonly node: string;
  };
  /** Absolute paths to in-process plugin modules (S15). */
  readonly plugins: readonly string[];
}

export type JsBenchConfigPartial = {
  readonly outputDir?: string;
  readonly workspaceRoot?: string;
  readonly defaultRunner?: "native" | "docker";
  readonly strictDoctor?: boolean;
  readonly profilesDir?: string;
  readonly logLevel?: LogLevel;
  readonly redactEnv?: readonly string[];
  readonly toolchains?: {
    readonly node?: string;
  };
  readonly plugins?: readonly string[];
};

export interface LoadConfigOptions {
  /** Project root used to resolve relative paths. Defaults to process.cwd(). */
  readonly cwd?: string;
  /** Optional explicit path to jsbench.config.yaml */
  readonly configPath?: string;
  /** Highest-precedence overrides (typically CLI flags). */
  readonly cliOverrides?: JsBenchConfigPartial;
  /** Injected env map for tests. Defaults to process.env. */
  readonly env?: NodeJS.ProcessEnv;
}
