import { BenchError } from "../../errors/bench-error.js";
import { resolveOnPath } from "../../runners/native/discover.js";
import { npmCacheEnv } from "./cache-dirs.js";
import type { PackageManagerAction, PackageManagerAdapter, ResolvedPmCommand } from "./types.js";

function resolveNpmBinary(): string {
  const override = process.env["JSBENCH_NPM"];
  if (override !== undefined && override !== "") {
    const resolved = resolveOnPath(override) ?? override;
    return resolved;
  }
  const fromPath = resolveOnPath("npm");
  if (fromPath === undefined) {
    throw new BenchError("TOOL_NOT_FOUND", "npm not found on PATH (set JSBENCH_NPM)", {});
  }
  return fromPath;
}

function mapAction(action: PackageManagerAction): readonly string[] {
  switch (action) {
    case "packageManager.install":
    case "packageManager.install.cold":
      // Generators do not emit lockfiles by default — use install, not ci.
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

export function createNpmAdapter(): PackageManagerAdapter {
  return {
    id: "npm",
    resolve(action, cacheDir, options = {}): ResolvedPmCommand {
      const resolveBinary = options.resolveBinary !== false;
      return {
        command: resolveBinary ? resolveNpmBinary() : "npm",
        args: mapAction(action),
        extraEnv: npmCacheEnv(cacheDir),
      };
    },
  };
}
