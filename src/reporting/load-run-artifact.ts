import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { BenchError } from "../errors/bench-error.js";
import type { RunArtifact } from "./types.js";
import { assertValidRunArtifact } from "./validate-run-artifact.js";

/**
 * Load a RunArtifact from a run directory or a path to `run.json`.
 */
export async function loadRunArtifact(pathOrDir: string): Promise<RunArtifact> {
  let runJsonPath = pathOrDir;
  try {
    const info = await stat(pathOrDir);
    if (info.isDirectory()) {
      runJsonPath = join(pathOrDir, "run.json");
    }
  } catch (error) {
    throw new BenchError("INVALID_CONFIG", `Cannot read run path: ${pathOrDir}`, {
      path: pathOrDir,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  let raw: string;
  try {
    raw = await readFile(runJsonPath, "utf8");
  } catch (error) {
    throw new BenchError("INVALID_CONFIG", `Cannot read run.json: ${runJsonPath}`, {
      path: runJsonPath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new BenchError("INVALID_CONFIG", `Invalid JSON in ${runJsonPath}`, {
      path: runJsonPath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  assertValidRunArtifact(parsed);
  return parsed;
}
