import { join } from "node:path";

/**
 * Run-scoped cache directory for one matrix cell.
 * Layout: `<workspaceRoot>/<runId>/_caches/<cellId>/`
 */
export function cellCacheRoot(options: {
  readonly workspaceRoot: string;
  readonly runId: string;
  readonly cellId: string;
}): string {
  return join(options.workspaceRoot, options.runId, "_caches", options.cellId);
}

export function npmCacheEnv(cacheDir: string): Record<string, string> {
  return {
    npm_config_cache: join(cacheDir, "npm"),
  };
}

export function pnpmCacheEnv(cacheDir: string): Record<string, string> {
  return {
    PNPM_STORE_DIR: join(cacheDir, "pnpm-store"),
    npm_config_cache: join(cacheDir, "npm"),
  };
}

/**
 * Yarn Berry: isolated cache + node-modules linker for tsc-friendly layouts.
 */
export function yarnCacheEnv(cacheDir: string): Record<string, string> {
  return {
    YARN_CACHE_FOLDER: join(cacheDir, "yarn"),
    YARN_ENABLE_GLOBAL_CACHE: "false",
    YARN_NODE_LINKER: "node-modules",
  };
}
