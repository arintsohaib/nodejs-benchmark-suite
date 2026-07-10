import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { ResolvedStage } from "./types.js";

/**
 * Apply cold/reset workspace policy before a stage.
 * Does not touch operator global package-manager caches.
 */
export async function applyStageWorkspacePolicy(
  workspacePath: string,
  stage: ResolvedStage,
): Promise<void> {
  const cold =
    stage.cache === "cold" ||
    stage.action === "packageManager.install.cold" ||
    stage.reset === "clean-install" ||
    stage.reset === "purge-all";

  if (cold) {
    await rm(join(workspacePath, "node_modules"), { recursive: true, force: true });
  }

  if (stage.reset === "purge-all") {
    await rm(join(workspacePath, "dist"), { recursive: true, force: true });
    await rm(join(workspacePath, ".next"), { recursive: true, force: true });
  }
}
