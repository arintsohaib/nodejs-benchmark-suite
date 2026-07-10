import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BenchError } from "../errors/bench-error.js";
import type { VersionResolver } from "./types.js";

type PinFile = {
  readonly packages: Readonly<Record<string, string>>;
};

const HERE = dirname(fileURLToPath(import.meta.url));

function loadPinFile(explicitPath?: string): PinFile {
  const candidates = [
    ...(explicitPath !== undefined ? [explicitPath] : []),
    join(process.cwd(), "templates", "resolved-versions.json"),
    join(HERE, "..", "..", "templates", "resolved-versions.json"),
    join(HERE, "..", "..", "..", "templates", "resolved-versions.json"),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(candidate, "utf8")) as PinFile;
    if (parsed.packages === undefined) {
      throw new BenchError(
        "VALIDATION_ERROR",
        `Invalid pin file (missing packages): ${candidate}`,
        {
          path: candidate,
        },
      );
    }
    return parsed;
  }
  throw new BenchError("IO_ERROR", "Unable to locate templates/resolved-versions.json", {
    candidates,
  });
}

/**
 * Resolve `policy:*` dependency specs to offline pins from `templates/resolved-versions.json`.
 * Non-policy specs are returned unchanged.
 */
export function createPinResolver(
  options: { readonly pinFilePath?: string } = {},
): VersionResolver {
  const pins = loadPinFile(options.pinFilePath);
  return {
    resolve(spec: string, packageName?: string) {
      if (!spec.startsWith("policy:")) {
        return spec;
      }
      if (packageName === undefined || packageName === "") {
        throw new BenchError("VALIDATION_ERROR", `Cannot resolve ${spec} without a package name`, {
          spec,
        });
      }
      const pinned = pins.packages[packageName];
      if (pinned === undefined) {
        throw new BenchError(
          "VALIDATION_ERROR",
          `No offline pin for package "${packageName}" (spec ${spec})`,
          { packageName, spec },
        );
      }
      return pinned;
    },
  };
}

export function identityVersionResolver(): VersionResolver {
  return {
    resolve(spec: string) {
      return spec;
    },
  };
}
