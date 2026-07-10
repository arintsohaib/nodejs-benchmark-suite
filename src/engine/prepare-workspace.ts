import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { isBenchError } from "../errors/bench-error.js";
import { materialize } from "../generator/materialize.js";
import type { BenchmarkProfile } from "../profiles/types.js";

export type PrepareWorkspaceResult = {
  readonly seededFrom?: string;
  readonly mode?: "static" | "generated";
  readonly contentDigest?: string;
};

/**
 * Prepare a cell workspace:
 * 1. Copy static fixture directory when `workload.template` is an existing path.
 * 2. Otherwise materialize a generator template id (`node-ts-lib`, …).
 * 3. Unknown non-path templates leave an empty directory (raw.command-only).
 */
export async function prepareWorkspace(options: {
  readonly workspacePath: string;
  readonly profile: BenchmarkProfile;
  readonly cwd: string;
}): Promise<PrepareWorkspaceResult> {
  await mkdir(options.workspacePath, { recursive: true });

  const template = options.profile.workload.template;
  const candidate = isAbsolute(template) ? template : resolve(options.cwd, template);

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const existing = await readdir(options.workspacePath);
      if (existing.length > 0) {
        return { seededFrom: candidate, mode: "static" };
      }
      await cp(candidate, options.workspacePath, { recursive: true });
      await mkdir(join(options.workspacePath), { recursive: true });
      return { seededFrom: candidate, mode: "static" };
    }
  } catch {
    // Not a local directory — try generator template id below.
  }

  try {
    const size = options.profile.workload.size ?? "tiny";
    const seed = options.profile.workload.seed ?? 1;
    const ref = await materialize({
      workload: {
        template,
        size,
        seed,
        ...(options.profile.workload.params !== undefined
          ? { params: options.profile.workload.params }
          : {}),
      },
      workspacePath: options.workspacePath,
      cwd: options.cwd,
    });
    return {
      seededFrom: `template:${template}`,
      mode: "generated",
      contentDigest: ref.contentDigest,
    };
  } catch (error) {
    if (
      isBenchError(error) &&
      error.code === "VALIDATION_ERROR" &&
      /Unknown template/.test(error.message)
    ) {
      return {};
    }
    throw error;
  }
}
