import type { SizeKnobs, SizePresetName } from "./types.js";

/**
 * Default size knobs when a template omits a preset definition.
 * Templates should override these in `template.manifest.yaml` for reviewable changes.
 */
export const DEFAULT_SIZE_PRESETS: Readonly<Record<SizePresetName, SizeKnobs>> = {
  tiny: { fileCount: 2, packageCount: 1, tsComplexity: 1, dependencySet: "minimal" },
  small: { fileCount: 8, packageCount: 1, tsComplexity: 2, dependencySet: "minimal" },
  medium: { fileCount: 24, packageCount: 1, tsComplexity: 3, dependencySet: "standard" },
  large: { fileCount: 64, packageCount: 1, tsComplexity: 4, dependencySet: "standard" },
  xlarge: { fileCount: 128, packageCount: 1, tsComplexity: 5, dependencySet: "heavy" },
};

export function isSizePresetName(value: string): value is SizePresetName {
  return value in DEFAULT_SIZE_PRESETS;
}
