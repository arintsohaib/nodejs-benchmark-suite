import { BenchError } from "../errors/bench-error.js";
import type { WorkloadSpec } from "../profiles/types.js";
import { DEFAULT_SIZE_PRESETS, isSizePresetName } from "./size-presets.js";
import type { ExpandedWorkloadParams, SizePresetName, TemplateManifest } from "./types.js";

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string | undefined): string | undefined {
  return typeof value === "string" ? value : fallback;
}

/**
 * Expand size preset + workload params into concrete knobs.
 * Explicit `workload.params` always win over size defaults.
 */
export function expandWorkloadParams(
  workload: WorkloadSpec,
  manifest: TemplateManifest,
): ExpandedWorkloadParams {
  const sizeName = (workload.size ?? "tiny") as string;
  if (!isSizePresetName(sizeName)) {
    throw new BenchError("INVALID_PROFILE", `Unknown size preset: ${sizeName}`, { size: sizeName });
  }
  const size = sizeName as SizePresetName;

  if (!manifest.supports.sizes.includes(size)) {
    throw new BenchError(
      "INVALID_PROFILE",
      `Template "${manifest.id}" does not support size "${size}"`,
      { templateId: manifest.id, size, supported: manifest.supports.sizes },
    );
  }

  const fromDefaults = DEFAULT_SIZE_PRESETS[size];
  const fromManifest = manifest.sizes?.[size];
  const base = {
    fileCount: fromManifest?.fileCount ?? fromDefaults.fileCount,
    packageCount: fromManifest?.packageCount ?? fromDefaults.packageCount,
    tsComplexity: fromManifest?.tsComplexity ?? fromDefaults.tsComplexity,
    dependencySet: fromManifest?.dependencySet ?? fromDefaults.dependencySet,
  };

  const extras = workload.params ?? {};
  const fileCount = asNumber(extras["fileCount"], base.fileCount);
  const packageCount = asNumber(extras["packageCount"], base.packageCount);
  const tsComplexity = asNumber(extras["tsComplexity"], base.tsComplexity);
  const dependencySet = asString(extras["dependencySet"], base.dependencySet);

  return {
    size,
    seed: workload.seed ?? 1,
    fileCount,
    packageCount,
    tsComplexity,
    ...(dependencySet !== undefined ? { dependencySet } : {}),
    extras,
  };
}
