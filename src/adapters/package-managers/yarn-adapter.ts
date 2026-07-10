import { BenchError } from "../../errors/bench-error.js";
import { resolveOnPath } from "../../runners/native/discover.js";
import { yarnCacheEnv } from "./cache-dirs.js";
import type { PackageManagerAction, PackageManagerAdapter, ResolvedPmCommand } from "./types.js";

function resolveYarnBinary(): string {
  const override = process.env["JSBENCH_YARN"];
  if (override !== undefined && override !== "") {
    return resolveOnPath(override) ?? override;
  }
  const fromPath = resolveOnPath("yarn");
  if (fromPath === undefined) {
    throw new BenchError("TOOL_NOT_FOUND", "yarn not found on PATH (set JSBENCH_YARN)", {});
  }
  return fromPath;
}

/** Yarn Berry argv mapping (Classic only via a future explicit profile). */
function mapAction(action: PackageManagerAction): readonly string[] {
  switch (action) {
    case "packageManager.install":
    case "packageManager.install.cold":
      return ["install"];
    case "project.build":
      return ["build"];
    case "project.typecheck":
      return ["typecheck"];
    case "project.test":
      return ["test"];
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function createYarnAdapter(): PackageManagerAdapter {
  return {
    id: "yarn",
    resolve(action, cacheDir, options = {}): ResolvedPmCommand {
      const resolveBinary = options.resolveBinary !== false;
      return {
        command: resolveBinary ? resolveYarnBinary() : "yarn",
        args: mapAction(action),
        extraEnv: yarnCacheEnv(cacheDir),
      };
    },
  };
}
