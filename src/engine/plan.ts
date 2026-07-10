import type { BenchmarkProfile } from "../profiles/types.js";
import { expandMatrixCells } from "./expand-matrix.js";
import { createRunId } from "./run-id.js";
import type { Planner, ResolvedStage, RunPlan } from "./types.js";

export interface CreateRunPlanOptions {
  readonly profile: BenchmarkProfile;
  readonly profileDigest: string;
  /** Injected for tests; defaults to a new id. */
  readonly runId?: string;
  readonly now?: Date;
}

function resolveStages(profile: BenchmarkProfile): readonly ResolvedStage[] {
  return profile.stages.map((stage) => {
    let resolved: ResolvedStage = {
      id: stage.id,
      action: stage.action,
    };
    if (stage.cache !== undefined) {
      resolved = { ...resolved, cache: stage.cache };
    }
    if (stage.timeoutMs !== undefined) {
      resolved = { ...resolved, timeoutMs: stage.timeoutMs };
    }
    if (stage.network !== undefined) {
      resolved = { ...resolved, network: stage.network };
    }
    if (stage.command !== undefined) {
      resolved = { ...resolved, command: stage.command };
    }
    if (stage.args !== undefined) {
      resolved = { ...resolved, args: stage.args };
    }
    if (stage.reset !== undefined) {
      resolved = { ...resolved, reset: stage.reset };
    }
    return resolved;
  });
}

/**
 * Expand a validated profile into a RunPlan without executing stages.
 * @see docs/17_IMPLEMENTATION_PLAN.md S4
 */
export function createRunPlan(options: CreateRunPlanOptions): RunPlan {
  const cells = expandMatrixCells(options.profile.matrix);
  const warmup = options.profile.iterations.warmup ?? 0;

  return {
    runId: options.runId ?? createRunId(options.now ?? new Date()),
    profileDigest: options.profileDigest,
    profile: options.profile,
    cells,
    stages: resolveStages(options.profile),
    iterations: options.profile.iterations.measured,
    warmup,
  };
}

export function createPlanner(): Planner {
  return {
    plan(profile, profileDigest) {
      return createRunPlan({ profile, profileDigest });
    },
  };
}
