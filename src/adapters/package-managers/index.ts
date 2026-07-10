import { BenchError } from "../../errors/bench-error.js";
import { createNpmAdapter } from "./npm-adapter.js";
import { createPnpmAdapter } from "./pnpm-adapter.js";
import {
  type PackageManagerAction,
  type PackageManagerAdapter,
  type PackageManagerId,
  type ResolvedPmCommand,
  isPackageManagerAction,
  isPackageManagerId,
} from "./types.js";
import { createYarnAdapter } from "./yarn-adapter.js";

const adapters: Record<PackageManagerId, PackageManagerAdapter> = {
  npm: createNpmAdapter(),
  pnpm: createPnpmAdapter(),
  yarn: createYarnAdapter(),
};

export function getPackageManagerAdapter(id: PackageManagerId): PackageManagerAdapter {
  return adapters[id];
}

/**
 * Resolve an abstract PM/project action for a matrix cell.
 */
export function resolvePackageManagerAction(options: {
  readonly packageManager: string;
  readonly action: PackageManagerAction;
  readonly cacheDir: string;
  readonly resolveBinary?: boolean;
}): ResolvedPmCommand {
  if (!isPackageManagerId(options.packageManager)) {
    throw new BenchError(
      "INVALID_PROFILE",
      `Unsupported packageManager "${options.packageManager}" (expected npm|pnpm|yarn)`,
      { packageManager: options.packageManager },
    );
  }
  return getPackageManagerAdapter(options.packageManager).resolve(
    options.action,
    options.cacheDir,
    options.resolveBinary === undefined ? {} : { resolveBinary: options.resolveBinary },
  );
}

export {
  createNpmAdapter,
  createPnpmAdapter,
  createYarnAdapter,
  isPackageManagerAction,
  isPackageManagerId,
  type PackageManagerAction,
  type PackageManagerAdapter,
  type PackageManagerId,
  type ResolvedPmCommand,
};
