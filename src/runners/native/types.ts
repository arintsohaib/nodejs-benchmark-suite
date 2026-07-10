/**
 * Native process runner types.
 * @see docs/05_NATIVE_BENCHMARK.md
 * @see docs/17_IMPLEMENTATION_PLAN.md S6
 */

export type ProcessRunStatus = "passed" | "failed" | "timeout";

export type RunProcessOptions = {
  /** Executable path or name (resolved via PATH when not absolute). */
  readonly command: string;
  /** Argv array — never a shell string. */
  readonly args: readonly string[];
  readonly cwd: string;
  /** Kill the process group after this many milliseconds. */
  readonly timeoutMs: number;
  /** Directory for stdout/stderr log files (created if missing). */
  readonly logDir: string;
  /** Basename prefix, e.g. `build-1` → `build-1.out.log` / `build-1.err.log`. */
  readonly logPrefix: string;
  /** Source env to scrub (defaults to `process.env`). */
  readonly env?: NodeJS.ProcessEnv;
  /** Include HTTP(S) proxy variables in the scrubbed env. Default: false. */
  readonly includeProxies?: boolean;
  /** Extra vars merged after scrubbing (e.g. run-scoped cache dirs). */
  readonly extraEnv?: Readonly<Record<string, string>>;
};

export type ProcessRunResult = {
  readonly status: ProcessRunStatus;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly durationMs: number;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly pid: number | undefined;
};

export type ToolchainDiscovery = {
  readonly node: {
    readonly path: string;
    readonly version: string;
  };
  readonly npm?: {
    readonly path: string;
    readonly version: string;
  };
  readonly pnpm?: {
    readonly path: string;
    readonly version: string;
  };
  readonly yarn?: {
    readonly path: string;
    readonly version: string;
  };
};
