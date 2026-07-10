/**
 * Scrubbed environment allowlist for native stage processes.
 * @see docs/05_NATIVE_BENCHMARK.md §13
 */

const BASE_ALLOWLIST = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "CI",
  "TMPDIR",
  "TMP",
  "TEMP",
  "TERM",
] as const;

const PROXY_ALLOWLIST = [
  "http_proxy",
  "https_proxy",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "no_proxy",
  "NO_PROXY",
  "ALL_PROXY",
  "all_proxy",
] as const;

export type ScrubEnvOptions = {
  readonly includeProxies?: boolean;
  readonly extra?: Readonly<Record<string, string>>;
};

/**
 * Build a minimal env for spawned stages from an allowlist.
 * Does not inherit the full operator environment.
 */
export function scrubEnv(
  source: NodeJS.ProcessEnv = process.env,
  options: ScrubEnvOptions = {},
): Record<string, string> {
  const keys = new Set<string>(BASE_ALLOWLIST);
  if (options.includeProxies === true) {
    for (const key of PROXY_ALLOWLIST) {
      keys.add(key);
    }
  }

  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== "") {
      result[key] = value;
    }
  }

  if (options.extra !== undefined) {
    for (const [key, value] of Object.entries(options.extra)) {
      result[key] = value;
    }
  }

  return result;
}

export const NATIVE_ENV_ALLOWLIST = [...BASE_ALLOWLIST] as const;
export const NATIVE_PROXY_ENV_ALLOWLIST = [...PROXY_ALLOWLIST] as const;
