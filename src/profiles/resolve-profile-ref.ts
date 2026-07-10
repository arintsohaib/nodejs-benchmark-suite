import { constants, access } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { BenchError } from "../errors/bench-error.js";

const PROFILE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export type ResolveProfileRefOptions = {
  readonly cwd?: string;
  /** Absolute or cwd-relative profiles directory (from config). */
  readonly profilesDir: string;
};

/**
 * Resolve a profile path or built-in id (e.g. `native-smoke`) to an absolute file path.
 * Tries, in order: explicit path; `{profilesDir}/{id}.yaml`; `{profilesDir}/{id}.json`.
 */
export async function resolveProfileRef(
  ref: string,
  options: ResolveProfileRefOptions,
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const profilesDir = isAbsolute(options.profilesDir)
    ? options.profilesDir
    : resolve(cwd, options.profilesDir);

  const asPath = isAbsolute(ref) ? ref : resolve(cwd, ref);
  if (await pathExists(asPath)) {
    return asPath;
  }

  if (PROFILE_ID_PATTERN.test(ref)) {
    for (const ext of [".yaml", ".yml", ".json"] as const) {
      const candidate = join(profilesDir, `${ref}${ext}`);
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
  }

  throw new BenchError(
    "PROFILE_NOT_FOUND",
    `Profile not found: ${ref} (tried path and profilesDir id lookup under ${profilesDir})`,
    { ref, profilesDir, asPath },
  );
}
