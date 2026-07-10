import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BenchError } from "../errors/bench-error.js";
import { SUITE_VERSION } from "../version.js";
import { digestWorkspace } from "./digest.js";
import { expandWorkloadParams } from "./expand.js";
import { loadTemplateManifest } from "./load-manifest.js";
import { renderTemplateTree } from "./render.js";
import type {
  CleanMode,
  Generator,
  MaterializeInput,
  VersionResolver,
  WorkspaceMetadata,
  WorkspaceRef,
} from "./types.js";
import { GENERATOR_VERSION } from "./types.js";
import { createPinResolver } from "./version-resolver.js";

async function applyVersionResolver(
  workspacePath: string,
  resolver: VersionResolver,
): Promise<void> {
  const pkgPath = join(workspacePath, "package.json");
  const { readFile } = await import("node:fs/promises");
  let raw: string;
  try {
    raw = await readFile(pkgPath, "utf8");
  } catch {
    return;
  }
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  let changed = false;
  for (const field of ["dependencies", "devDependencies"] as const) {
    const block = pkg[field];
    if (block === undefined) {
      continue;
    }
    for (const [name, spec] of Object.entries(block)) {
      if (spec.startsWith("policy:")) {
        block[name] = await Promise.resolve(resolver.resolve(spec, name));
        changed = true;
      }
    }
  }
  if (changed) {
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }
}

/**
 * Materialize a deterministic workspace from a template + workload spec.
 * Default version resolver pins `policy:*` from `templates/resolved-versions.json`.
 */
export async function materialize(input: MaterializeInput): Promise<WorkspaceRef> {
  const template = await loadTemplateManifest(input.workload.template, {
    ...(input.templatesDir !== undefined ? { templatesDir: input.templatesDir } : {}),
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
  });
  const params = expandWorkloadParams(input.workload, template.manifest);

  await rm(input.workspacePath, { recursive: true, force: true });
  await renderTemplateTree({
    template,
    workspacePath: input.workspacePath,
    params,
  });

  const resolver = input.versionResolver ?? createPinResolver();
  await applyVersionResolver(input.workspacePath, resolver);

  const contentDigest = await digestWorkspace(input.workspacePath);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const metadata: WorkspaceMetadata = {
    generatorVersion: GENERATOR_VERSION,
    suiteVersion: SUITE_VERSION,
    templateId: template.manifest.id,
    size: params.size,
    seed: params.seed,
    params,
    contentDigest,
    createdAt,
  };

  await writeFile(
    join(input.workspacePath, ".jsbench-workspace.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  return {
    workspacePath: input.workspacePath,
    contentDigest,
    metadata,
  };
}

export async function cleanWorkspace(workspacePath: string, mode: CleanMode): Promise<void> {
  if (mode === "retain") {
    return;
  }
  if (mode === "purge-always" || mode === "purge-on-success") {
    await rm(workspacePath, { recursive: true, force: true });
    return;
  }
  throw new BenchError("VALIDATION_ERROR", `Unknown clean mode: ${String(mode)}`, { mode });
}

export function createGenerator(): Generator {
  return {
    materialize,
    digest: digestWorkspace,
    clean: cleanWorkspace,
  };
}
