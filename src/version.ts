import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "..", "package.json"), join(here, "..", "..", "package.json")];
  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as { version?: unknown };
      if (typeof parsed.version === "string" && parsed.version.length > 0) {
        return parsed.version;
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error("Unable to resolve suite version from package.json");
}

/** Suite package version — sourced from package.json (single source of truth). */
export const SUITE_VERSION = readPackageVersion();
