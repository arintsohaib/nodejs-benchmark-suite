import { BenchError } from "../../errors/bench-error.js";
import { resolveOnPath } from "../../runners/native/discover.js";
import { pnpmCacheEnv } from "./cache-dirs.js";
import type { PackageManagerAction, PackageManagerAdapter, ResolvedPmCommand } from "./types.js";

function resolvePnpmBinary(): string {
  const override = process.env["JSBENCH_PNPM"];
  if (override !== undefined && override !== "") {
    return resolveOnPath(override) ?? override;
  }
  const fromPath = resolveOnPath("pnpm");
  if (fromPath === undefined) {
    throw new BenchError("TOOL_NOT_FOUND", "pnpm not found on PATH (set JSBENCH_PNPM)", {});
  }
  return fromPath;
}

function mapAction(action: PackageManagerAction): readonly string[] {
  switch (action) {
    case "packageManager.install":
    case "packageManager.install.cold":
      return ["install"];
    case "project.build":
      return ["run", "build"];
    case "project.typecheck":
      return ["run", "typecheck"];
    case "project.test":
      return ["test"];
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function createPnpmAdapter(): PackageManagerAdapter {
  return {
    id: "pnpm",
    resolve(action, cacheDir, options = {}): ResolvedPmCommand {
      const resolveBinary = options.resolveBinary !== false;
      return {
        command: resolveBinary ? resolvePnpmBinary() : "pnpm",
        args: mapAction(action),
        extraEnv: pnpmCacheEnv(cacheDir),
      };
    },
  };
}
