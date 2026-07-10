import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { BenchError } from "../errors/bench-error.js";
import { assertValid, createSchemaValidator } from "../schemas/validate.js";
import { digestValue } from "./digest.js";
import type { BenchmarkProfile, LoadProfileOptions, LoadedProfile } from "./types.js";

const profileValidator = createSchemaValidator<BenchmarkProfile>("profile.schema.json");

/**
 * Load and validate a benchmark profile from a YAML or JSON file.
 * Does not execute benchmarks.
 */
export async function loadProfile(
  profilePath: string,
  options: LoadProfileOptions = {},
): Promise<LoadedProfile> {
  const cwd = options.cwd ?? process.cwd();
  const absolutePath = isAbsolute(profilePath) ? profilePath : resolve(cwd, profilePath);

  let rawText: string;
  try {
    rawText = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw new BenchError(
      "PROFILE_NOT_FOUND",
      `Profile not found: ${absolutePath}`,
      { path: absolutePath },
      { cause: error },
    );
  }

  let parsed: unknown;
  try {
    if (absolutePath.endsWith(".json")) {
      parsed = JSON.parse(rawText) as unknown;
    } else {
      parsed = parseYaml(rawText);
    }
  } catch (error) {
    throw new BenchError(
      "INVALID_PROFILE",
      `Failed to parse profile: ${absolutePath}`,
      { path: absolutePath },
      { cause: error },
    );
  }

  assertValid(profileValidator, parsed, "INVALID_PROFILE", "Profile");

  return {
    profile: parsed,
    path: absolutePath,
    digest: digestValue(parsed),
  };
}
